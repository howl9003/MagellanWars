#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
HTTP proxy for Archspace binary CGI protocol.
Accepts browser HTTP on PROXY_PORT, translates to the binary CGI protocol
that the archspace game server speaks on ARCHSPACE_PORT.
Also handles user registration and login to create phpBB-compatible sessions.
"""

import socket
import struct
import threading
import hashlib
import os
import re
import time
import urllib.parse
from http.server import HTTPServer, BaseHTTPRequestHandler

_IMAGE_EXTS = {'.gif', '.jpg', '.jpeg', '.png', '.ico', '.bmp', '.swf'}

# ─── SVG placeholder generator ───────────────────────────────────────────────
# Colours
_C_BG        = '#0a0a1a'   # page background
_C_BTN_BG    = '#0d1433'   # button fill
_C_BTN_BD    = '#3355aa'   # button border
_C_BTN_TXT   = '#99bbff'   # button text
_C_TITLE_BG  = '#10152a'   # title/banner fill
_C_TITLE_BD  = '#446699'   # title border
_C_TITLE_TXT = '#aaccff'   # title text
_C_ICON_TXT  = '#ccddff'   # icon label

# Race colours (hue by race)
_RACE_COLORS = {
    'human':       ('#1a2a4a', '#5577cc', '👤'),
    'targoid':     ('#1a2a1a', '#44aa44', '🦎'),
    'buckaneer':   ('#2a1a0a', '#cc8833', '☠'),
    'tecanoid':    ('#1a1a2a', '#9944cc', '🤖'),
    'xeloss':      ('#2a0a0a', '#cc3333', '👁'),
    'xesperados':  ('#2a1a2a', '#cc44aa', '🌀'),
    'evintos':     ('#0a1a2a', '#33aacc', '🌊'),
    'agerus':      ('#1a2a2a', '#33ccaa', '🌿'),
    'bosalian':    ('#2a2a0a', '#aaaa33', '⚡'),
    'xerusian':    ('#1a0a1a', '#aa33cc', '💎'),
}

# Ship component icons
_COMPONENT_ICONS = {
    'weapon': '⚔', 'shield': '🛡', 'armor': '🔩',
    'engine': '🚀', 'computer': '💻', 'device': '⚙',
}

# Spy op icons
_SPY_ICONS = {
    'assassination': '🗡', 'sabotage': '💣', 'steal_technology': '🔬',
    'steal_secret': '🕵', 'computer_virus': '💻', 'network_worm': '🐛',
    'emp_storm': '⚡', 'meteor_strike': '☄', 'stellar_bombardment': '💥',
    'red_death': '☠', 'incite_riot': '🔥', 'artificial_disease': '🧫',
    'general_information': '📋', 'detailed_information': '📊',
    'failure': '✗', 'strike_base': '🎯',
}

# Tech/research icons
_TECH_ICONS = {
    'info': 'ℹ', 'life': '♥', 'ms': 'MS', 'ss': 'SS',
    'research_tech_select_info':   'INFO',
    'research_tech_select_life':   'LIFE',
    'research_tech_select_matter': 'MTTR',
    'research_tech_select_social': 'SOC',
    'research_tech_select_none':   '—',
}


def _svg_escape(text):
    return text.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;').replace('"', '&quot;')


def _label_from_filename(name):
    """Turn a bare filename (no ext, no path) into a readable label."""
    # remove common prefixes
    for pfx in ('bu_', 'title_', 'create_', 'symbol_', 'spy_',
                 'main_', 'result_', 'small_', 'back_', 'planet_'):
        if name.startswith(pfx):
            name = name[len(pfx):]
            break
    # remove trailing _icon, _title
    name = re.sub(r'_(icon|title|ani)$', '', name)
    # underscores and hyphens → spaces, then title-case
    return name.replace('_', ' ').replace('-', ' ').title()


def _make_placeholder_svg(url_path):
    """Return SVG bytes for a missing game image based on its URL path."""
    # Normalise: lowercase, strip query, get just the filename part
    url_path = url_path.split('?')[0].lower()
    parts = url_path.rstrip('/').split('/')
    filename = parts[-1]                       # e.g. "bu_ok.gif"
    name, _ext = os.path.splitext(filename)    # e.g. "bu_ok"
    parent = parts[-2] if len(parts) >= 2 else ''

    # ── BUTTONS ─────────────────────────────────────────────────────────────
    if name.startswith('bu_'):
        label = _label_from_filename(name)
        w, h = 80, 24
        svg = (
            f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}">'
            f'<rect width="{w}" height="{h}" rx="3" fill="{_C_BTN_BG}" '
            f'stroke="{_C_BTN_BD}" stroke-width="1"/>'
            f'<text x="{w//2}" y="{h//2+5}" '
            f'font-family="Arial,sans-serif" font-size="11" font-weight="bold" '
            f'fill="{_C_BTN_TXT}" text-anchor="middle">{_svg_escape(label)}</text>'
            f'</svg>'
        )
        return svg.encode()

    # ── SECTION TITLES / BANNERS ─────────────────────────────────────────────
    if name.endswith('_title') or name.startswith('title_') or name in (
            'council_title', 'create_character_title'):
        label = _label_from_filename(name)
        w, h = 220, 32
        svg = (
            f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}">'
            f'<rect width="{w}" height="{h}" rx="2" fill="{_C_TITLE_BG}" '
            f'stroke="{_C_TITLE_BD}" stroke-width="1"/>'
            f'<line x1="6" y1="{h-5}" x2="{w-6}" y2="{h-5}" '
            f'stroke="{_C_TITLE_BD}" stroke-width="1" opacity="0.5"/>'
            f'<text x="{w//2}" y="{h//2+6}" '
            f'font-family="Arial,sans-serif" font-size="13" font-weight="bold" '
            f'fill="{_C_TITLE_TXT}" text-anchor="middle" letter-spacing="1">'
            f'{_svg_escape(label)}</text>'
            f'</svg>'
        )
        return svg.encode()

    # ── RACE PORTRAIT (create character) ────────────────────────────────────
    if name.startswith('create_'):
        race = name[len('create_'):]
        bg, bd, icon = _RACE_COLORS.get(race, ('#111', '#555', '👽'))
        label = race.title()
        w, h = 120, 150
        svg = (
            f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}">'
            f'<rect width="{w}" height="{h}" rx="4" fill="{bg}" '
            f'stroke="{bd}" stroke-width="2"/>'
            # big race icon
            f'<text x="{w//2}" y="75" font-size="52" text-anchor="middle" '
            f'dominant-baseline="middle">{icon}</text>'
            # race name label bar
            f'<rect x="0" y="{h-32}" width="{w}" height="32" rx="0" '
            f'fill="{bd}" opacity="0.7"/>'
            f'<text x="{w//2}" y="{h-10}" '
            f'font-family="Arial,sans-serif" font-size="13" font-weight="bold" '
            f'fill="#ffffff" text-anchor="middle">{_svg_escape(label)}</text>'
            f'</svg>'
        )
        return svg.encode()

    # ── RACE SYMBOL ──────────────────────────────────────────────────────────
    if name.startswith('symbol_'):
        race = name[len('symbol_'):]
        bg, bd, icon = _RACE_COLORS.get(race, ('#111', '#555', '👽'))
        w = h = 40
        svg = (
            f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}">'
            f'<rect width="{w}" height="{h}" rx="4" fill="{bg}" stroke="{bd}" stroke-width="1"/>'
            f'<text x="{w//2}" y="{h//2+1}" font-size="20" text-anchor="middle" '
            f'dominant-baseline="middle">{icon}</text>'
            f'</svg>'
        )
        return svg.encode()

    # ── MAIN SYMBOL / SMALL SYMBOL ───────────────────────────────────────────
    if name in ('main_symbol', 'symbol', 'small_symbol'):
        w = h = 60 if name == 'main_symbol' else 32
        svg = (
            f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}">'
            f'<rect width="{w}" height="{h}" rx="50%" fill="#0a0a1a" stroke="#334477" stroke-width="2"/>'
            f'<text x="{w//2}" y="{h//2+1}" font-size="{w//2}" text-anchor="middle" '
            f'dominant-baseline="middle" fill="#5577cc">✦</text>'
            f'</svg>'
        )
        return svg.encode()

    # ── SPY OPERATION ────────────────────────────────────────────────────────
    if name.startswith('spy_'):
        spy_key = name[len('spy_'):]
        icon = _SPY_ICONS.get(spy_key, '🕵')
        label = _label_from_filename(name)
        w, h = 80, 60
        svg = (
            f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}">'
            f'<rect width="{w}" height="{h}" rx="3" fill="#1a0a0a" stroke="#663333" stroke-width="1"/>'
            f'<text x="{w//2}" y="30" font-size="22" text-anchor="middle" '
            f'dominant-baseline="middle">{icon}</text>'
            f'<text x="{w//2}" y="{h-6}" font-family="Arial,sans-serif" font-size="8" '
            f'fill="#cc8888" text-anchor="middle">{_svg_escape(label[:12])}</text>'
            f'</svg>'
        )
        return svg.encode()

    # ── SHIP COMPONENT ───────────────────────────────────────────────────────
    if parent == 'ship_component' or name in _COMPONENT_ICONS:
        icon = _COMPONENT_ICONS.get(name, '⚙')
        w = h = 32
        svg = (
            f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}">'
            f'<rect width="{w}" height="{h}" rx="3" fill="#0d1a2a" stroke="#335577" stroke-width="1"/>'
            f'<text x="{w//2}" y="{h//2+1}" font-size="18" text-anchor="middle" '
            f'dominant-baseline="middle">{icon}</text>'
            f'</svg>'
        )
        return svg.encode()

    # ── TECH RESEARCH SELECT ──────────────────────────────────────────────────
    if name in _TECH_ICONS or parent == 'tech':
        icon = _TECH_ICONS.get(name, '🔬')
        w = h = 32
        svg = (
            f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}">'
            f'<rect width="{w}" height="{h}" rx="3" fill="#0a1a0a" stroke="#336633" stroke-width="1"/>'
            f'<text x="{w//2}" y="{h//2+5}" font-family="Arial,sans-serif" font-size="10" '
            f'font-weight="bold" fill="#66cc66" text-anchor="middle">{_svg_escape(icon)}</text>'
            f'</svg>'
        )
        return svg.encode()

    # ── PLANET ICONS ─────────────────────────────────────────────────────────
    if name in ('planet_home_icon', 'planet_icon', 'planet_box', 'planet_check'):
        icons_map = {
            'planet_home_icon': ('🏠', '#1a2a3a', '#336699'),
            'planet_icon':      ('🪐', '#0a1a2a', '#224488'),
            'planet_box':       ('□',  '#0a1020', '#334466'),
            'planet_check':     ('✓',  '#0a2010', '#336622'),
        }
        icon, bg, bd = icons_map.get(name, ('⬤', '#111', '#444'))
        w = h = 20
        svg = (
            f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}">'
            f'<rect width="{w}" height="{h}" rx="2" fill="{bg}" stroke="{bd}" stroke-width="1"/>'
            f'<text x="{w//2}" y="{h//2+1}" font-size="12" text-anchor="middle" '
            f'dominant-baseline="middle">{icon}</text>'
            f'</svg>'
        )
        return svg.encode()

    # ── COUNCIL ICONS ────────────────────────────────────────────────────────
    if 'required' in name:
        required = 'notrequired' not in name
        icon = '✓' if required else '—'
        color = '#55aa55' if required else '#888888'
        w = h = 20
        svg = (
            f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}">'
            f'<rect width="{w}" height="{h}" rx="50%" fill="#0a0a1a" stroke="{color}" stroke-width="1"/>'
            f'<text x="{w//2}" y="{h//2+1}" font-size="13" text-anchor="middle" '
            f'dominant-baseline="middle" fill="{color}">{icon}</text>'
            f'</svg>'
        )
        return svg.encode()

    # ── ADMIRAL ARROWS ───────────────────────────────────────────────────────
    if name.startswith('admrlarrow') or 'arrow' in name:
        direction = '▼' if name.endswith('12') else '▲'
        w, h = 11, 11
        svg = (
            f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}">'
            f'<text x="{w//2}" y="{h//2+1}" font-size="10" text-anchor="middle" '
            f'dominant-baseline="middle" fill="#7788aa">{direction}</text>'
            f'</svg>'
        )
        return svg.encode()

    # ── PROJECT ICONS ─────────────────────────────────────────────────────────
    if name.startswith('project_') or parent == 'project':
        proj_icons = {
            'project_council': '⚖', 'project_domain': '🌍',
            'project_planet': '🪐', 'project_secret': '🔒',
        }
        icon = proj_icons.get(name, '📋')
        w = h = 32
        svg = (
            f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}">'
            f'<rect width="{w}" height="{h}" rx="3" fill="#1a1a2a" stroke="#445588" stroke-width="1"/>'
            f'<text x="{w//2}" y="{h//2+1}" font-size="18" text-anchor="middle" '
            f'dominant-baseline="middle">{icon}</text>'
            f'</svg>'
        )
        return svg.encode()

    # ── SHIP CLASS ───────────────────────────────────────────────────────────
    if parent == 'ship_class':
        label = name  # usually a number like "1", "2" etc
        w, h = 60, 40
        svg = (
            f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}">'
            f'<rect width="{w}" height="{h}" rx="3" fill="#0a1020" stroke="#334466" stroke-width="1"/>'
            f'<text x="{w//2}" y="{h//2-4}" font-size="16" text-anchor="middle" '
            f'dominant-baseline="middle">🚀</text>'
            f'<text x="{w//2}" y="{h-5}" font-family="Arial,sans-serif" font-size="9" '
            f'fill="#7799bb" text-anchor="middle">CLASS {_svg_escape(label)}</text>'
            f'</svg>'
        )
        return svg.encode()

    # ── RESULT ICONS ─────────────────────────────────────────────────────────
    if parent == 'result' or name in ('error', 'message', 'pp', 'loading_ani'):
        result_icons = {
            'error': ('✗', '#aa2222'), 'message': ('✉', '#2255aa'),
            'pp': ('★', '#aaaa22'), 'loading_ani': ('⟳', '#4477aa'),
        }
        icon, color = result_icons.get(name, ('●', '#666688'))
        w = h = 24
        svg = (
            f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}">'
            f'<text x="{w//2}" y="{h//2+1}" font-size="16" text-anchor="middle" '
            f'dominant-baseline="middle" fill="{color}">{icon}</text>'
            f'</svg>'
        )
        return svg.encode()

    # ── MAIN PAGE GRAPHICS ────────────────────────────────────────────────────
    if name in ('main_img', 'back_menu', 'main_imperial_happening',
                'main_system_advisory', 'loading_ani'):
        labels = {
            'main_img':               ('Magellan Wars', 400, 80),
            'back_menu':              ('≡ Menu',          80, 24),
            'main_imperial_happening':('Imperial News',  200, 30),
            'main_system_advisory':   ('System Advisory',200, 30),
            'loading_ani':            ('Loading…',        80, 20),
        }
        lbl, w, h = labels.get(name, (name.replace('_', ' ').title(), 120, 30))
        is_banner = (h >= 60)
        fill = '#050a14' if is_banner else _C_TITLE_BG
        stroke = '#224466' if is_banner else _C_TITLE_BD
        txt_color = '#3366bb' if is_banner else _C_TITLE_TXT
        font_size = 28 if is_banner else 12
        svg = (
            f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}">'
            f'<rect width="{w}" height="{h}" rx="4" fill="{fill}" stroke="{stroke}" stroke-width="1"/>'
            f'<text x="{w//2}" y="{h//2+font_size//3}" '
            f'font-family="Arial,sans-serif" font-size="{font_size}" font-weight="bold" '
            f'fill="{txt_color}" text-anchor="middle" letter-spacing="2">'
            f'{_svg_escape(lbl)}</text>'
            f'</svg>'
        )
        return svg.encode()

    # ── MESSAGE ICON ─────────────────────────────────────────────────────────
    if name == 'message' or parent == 'message':
        w = h = 24
        svg = (
            f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}">'
            f'<rect width="{w}" height="{h}" rx="3" fill="#0a1020" stroke="#334488" stroke-width="1"/>'
            f'<text x="{w//2}" y="{h//2+1}" font-size="14" text-anchor="middle" '
            f'dominant-baseline="middle">✉</text>'
            f'</svg>'
        )
        return svg.encode()

    # ── FLEET ICONS ──────────────────────────────────────────────────────────
    if name in ('ship_cap', 'ship_set') or parent == 'fleet':
        icon = '⚓' if 'cap' in name else '⚙'
        w = h = 24
        svg = (
            f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}">'
            f'<rect width="{w}" height="{h}" rx="3" fill="#0a0a1a" stroke="#334466" stroke-width="1"/>'
            f'<text x="{w//2}" y="{h//2+1}" font-size="14" text-anchor="middle" '
            f'dominant-baseline="middle" fill="#7799bb">{icon}</text>'
            f'</svg>'
        )
        return svg.encode()

    # ── FALLBACK: generic labeled box ────────────────────────────────────────
    label = _label_from_filename(name)
    # Limit label length to fit
    if len(label) > 16:
        label = label[:14] + '…'
    w = max(60, min(180, len(label) * 8 + 16))
    h = 24
    svg = (
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}">'
        f'<rect width="{w}" height="{h}" rx="2" fill="{_C_BG}" '
        f'stroke="#334466" stroke-width="1"/>'
        f'<text x="{w//2}" y="{h//2+5}" '
        f'font-family="Arial,sans-serif" font-size="10" '
        f'fill="{_C_ICON_TXT}" text-anchor="middle">{_svg_escape(label)}</text>'
        f'</svg>'
    )
    return svg.encode()

# ─── Frame layout HTML ───────────────────────────────────────────────────────
# The game was designed around a 3-frame layout:
#   top row  (97px):  /up.html  — header / race banner
#   bottom left (172px): /left.html — JS tree navigation (served from menu.as)
#   bottom right:     /archspace/login.as → updates to content pages
_FRAMESET_HTML = b"""\
<!DOCTYPE html>
<html>
<head>
<title>Magellan Wars</title>
<meta http-equiv="Content-Type" content="text/html; charset=iso-8859-1">
<meta http-equiv="Cache-Control" content="no-cache">
</head>
<frameset rows="80,*" cols="*" frameborder="no" border="0" framespacing="0">
  <frame src="/up.html" frameborder="no" noresize scrolling="no"
         marginwidth="0" marginheight="0" name="up">
  <frameset cols="172,*" rows="*" frameborder="no" border="0" framespacing="0">
    <frame src="/left.html" frameborder="no" name="left"
           marginwidth="0" marginheight="0">
    <frame src="/archspace/login.as" frameborder="no" name="contents"
           marginwidth="4" marginheight="4">
  </frameset>
</frameset>
<noframes>
<body bgcolor="#000000" style="color:#ccc;font-family:Arial">
  Your browser does not support frames.
  <a href="/archspace/main.as" style="color:#88f">Click here to play</a>.
</body>
</noframes>
</html>
"""

_UP_FRAME_HTML = b"""\
<!DOCTYPE html>
<html>
<head>
<meta http-equiv="Content-Type" content="text/html; charset=iso-8859-1">
<link rel="stylesheet" href="/archspace.css">
<style>
  body { background:#000; margin:0; padding:0; overflow:hidden; }
  .header {
    display:flex; align-items:center; justify-content:space-between;
    height:80px; padding:0 16px;
    background: linear-gradient(180deg, #0a0a1e 0%, #050510 100%);
    border-bottom: 1px solid #223366;
  }
  .title {
    font-family: "Arial Black", Arial, sans-serif;
    font-size: 22px; font-weight: 900; letter-spacing: 3px;
    color: #3a5fcc;
    text-shadow: 0 0 12px #3a5fcc88;
  }
  .subtitle { font-size: 10px; color: #445; letter-spacing: 2px; margin-top:2px; }
  .nav-links { font-size: 11px; }
  .nav-links a { color: #556699; text-decoration: none; margin-left: 14px; }
  .nav-links a:hover { color: #aac; }
  .stars {
    position:absolute; top:0; left:0; width:100%; height:80px;
    pointer-events:none; overflow:hidden;
  }
</style>
</head>
<body>
<div class="header">
  <div>
    <div class="title">MAGELLAN WARS</div>
    <div class="subtitle">SPACE STRATEGY &nbsp;|&nbsp; ARCHSPACE ENGINE</div>
  </div>
  <div class="nav-links">
    <a href="/archspace/main.as" target="contents">Overview</a>
    <a href="/archspace/preference.as" target="contents">Settings</a>
    <a href="/archspace/logout.as" target="_top">Logout</a>
  </div>
</div>
</body>
</html>
"""

import pymysql

ARCHSPACE_HOST = os.environ.get('ARCHSPACE_HOST', 'archspace')
ARCHSPACE_PORT = int(os.environ.get('ARCHSPACE_PORT', '12345'))
PROXY_PORT = int(os.environ.get('PROXY_PORT', '8080'))
DB_HOST = os.environ.get('DB_HOST', 'db')
DB_USER = os.environ.get('DB_USER', 'archspace')
DB_PASS = os.environ.get('DB_PASS', 'archspace')
DB_NAME = os.environ.get('DB_NAME', 'Archspace2')
WEB_ROOT = os.environ.get('WEB_ROOT', '/var/archspace/web')

# MIME types for static file serving
MIME_TYPES = {
    '.css':  'text/css',
    '.js':   'application/javascript',
    '.gif':  'image/gif',
    '.jpg':  'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png':  'image/png',
    '.html': 'text/html',
    '.htm':  'text/html',
    '.ico':  'image/x-icon',
    '.swf':  'application/x-shockwave-flash',
}

# Binary CGI protocol constants
MESSAGE_HEADER_SIZE = 8
STRING_DATA_BLOCK_SIZE = 3980
MAX_RECV_SIZE = 8192

MT_TERMINATE_REQUEST    = 0x0000
MT_ERROR_SEND           = 0x0001
MT_URL_SEND             = 0x8001
MT_METHOD_SEND          = 0x8003
MT_REFERER_SEND         = 0x8005
MT_COOKIE_SEND          = 0x8007
MT_ACCEPT_ENCODING_SEND = 0x8009
MT_ACCEPT_LANGUAGE_SEND = 0x800B
MT_USER_AGENT_SEND      = 0x800D
MT_HOST_NAME_SEND       = 0x800F
MT_CONNECTION_INFO_SEND = 0x8011
MT_QUERY_SEND           = 0x8013
MT_GET_PAGE_REQUEST     = 0x8015
MT_SET_COOKIE_SEND      = 0x8103
MT_CONTENT_SEND         = 0x8105

# Item type constants (octal in C source)
MESSAGE_ITEM_ASCII = 1   # octal 001
MESSAGE_ITEM_UINT1 = 9   # octal 011

_counter_lock = threading.Lock()
_counter = 0


def _next_counter():
    global _counter
    with _counter_lock:
        _counter = (_counter + 1) & 0xFFFF
        return _counter


def _recv_all(sock, n):
    data = b''
    while len(data) < n:
        chunk = sock.recv(n - len(data))
        if not chunk:
            raise ConnectionError('connection closed by archspace')
        data += chunk
    return data


def _encode_uint1(val):
    # MESSAGE_ITEM_UINT1=9: header=(9<<2)|1=0x25, size_byte=1, data=val
    return bytes([0x25, 1, val & 0xFF])


def _encode_ascii(data):
    # MESSAGE_ITEM_ASCII=1: header=(1<<2)|size_bytes, then size, then data
    if isinstance(data, str):
        data = data.encode('latin-1', errors='replace')
    n = len(data)
    if n < 256:
        return bytes([0x05, n]) + data     # (1<<2)|1 = 5
    else:
        return bytes([0x06, n & 0xFF, (n >> 8) & 0xFF]) + data  # (1<<2)|2 = 6


def _make_packet(msg_type, items_data=b'', server_id=0):
    size = MESSAGE_HEADER_SIZE + len(items_data)
    counter = _next_counter()
    header = struct.pack('<HHHH', size, msg_type, server_id, counter)
    return header + items_data


def _send_string(sock, msg_type, text):
    """Send text as one or more binary CGI string packets."""
    if isinstance(text, str):
        text = text.encode('latin-1', errors='replace')
    length = len(text)
    if length == 0:
        return
    done = 0
    block_num = 0
    while done < length:
        chunk_size = min(STRING_DATA_BLOCK_SIZE, length - done)
        chunk = text[done:done + chunk_size]
        items = _encode_uint1(block_num) + _encode_ascii(chunk)
        sock.sendall(_make_packet(msg_type, items))
        done += chunk_size
        block_num += 1


def _read_packet(sock):
    """Read one binary CGI packet. Returns (msg_type, items_data)."""
    hdr = _recv_all(sock, 2)
    size = hdr[0] | (hdr[1] << 8)
    if size < MESSAGE_HEADER_SIZE or size > 65535:
        raise ValueError(f'invalid packet size {size}')
    rest = _recv_all(sock, size - 2)
    packet = hdr + rest
    _psize, msg_type, _server, _counter = struct.unpack_from('<HHHH', packet)
    items_data = packet[MESSAGE_HEADER_SIZE:size]
    return msg_type, items_data


def _parse_string_block(items_data):
    """Extract (block_num, bytes_chunk) from a string-block items payload."""
    pos = 0
    block_num = 0
    chunk = b''
    while pos < len(items_data):
        hbyte = items_data[pos]
        item_type = hbyte >> 2
        byte_of_count = hbyte & 0x03
        if byte_of_count == 0:
            break
        if byte_of_count == 1:
            if pos + 1 >= len(items_data):
                break
            count = items_data[pos + 1]
            data_start = pos + 2
        elif byte_of_count == 2:
            if pos + 2 >= len(items_data):
                break
            count = items_data[pos + 1] | (items_data[pos + 2] << 8)
            data_start = pos + 3
        else:
            break
        item_data = items_data[data_start:data_start + count]
        if item_type == 0:  # LIST
            pos += 1 + byte_of_count
        else:
            pos += 1 + byte_of_count + count
        if item_type == MESSAGE_ITEM_UINT1 and count == 1:
            block_num = item_data[0]
        elif item_type == MESSAGE_ITEM_ASCII:
            chunk = item_data
    return block_num, chunk


def proxy_to_archspace(method, uri, query, headers_dict, client_ip):
    """Send an HTTP-derived request to archspace via binary CGI protocol.
    Returns (content_bytes, set_cookie_str)."""
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.settimeout(30)
    sock.connect((ARCHSPACE_HOST, ARCHSPACE_PORT))
    try:
        _send_string(sock, MT_URL_SEND, uri)
        _send_string(sock, MT_METHOD_SEND, method)

        for hdr_name, mt in [
            ('Referer',          MT_REFERER_SEND),
            ('Cookie',           MT_COOKIE_SEND),
            ('Accept-Encoding',  MT_ACCEPT_ENCODING_SEND),
            ('Accept-Language',  MT_ACCEPT_LANGUAGE_SEND),
            ('User-Agent',       MT_USER_AGENT_SEND),
            ('Host',             MT_HOST_NAME_SEND),
        ]:
            val = headers_dict.get(hdr_name, '')
            if val:
                _send_string(sock, mt, val)

        _send_string(sock, MT_CONNECTION_INFO_SEND, client_ip)
        if query:
            _send_string(sock, MT_QUERY_SEND, query)

        sock.sendall(_make_packet(MT_GET_PAGE_REQUEST))

        content_blocks = {}
        cookie_blocks = {}

        for _ in range(50000):
            msg_type, items_data = _read_packet(sock)
            if msg_type in (MT_TERMINATE_REQUEST, MT_ERROR_SEND):
                break
            elif msg_type == MT_CONTENT_SEND:
                bn, chunk = _parse_string_block(items_data)
                content_blocks[bn] = chunk
            elif msg_type == MT_SET_COOKIE_SEND:
                bn, chunk = _parse_string_block(items_data)
                cookie_blocks[bn] = chunk

        content = b''.join(content_blocks[i] for i in sorted(content_blocks))
        set_cookie = b''.join(
            cookie_blocks[i] for i in sorted(cookie_blocks)
        ).decode('latin-1', errors='replace')
        return content, set_cookie
    finally:
        sock.close()


def _get_db():
    return pymysql.connect(
        host=DB_HOST, user=DB_USER, password=DB_PASS,
        database=DB_NAME, charset='latin1',
        cursorclass=pymysql.cursors.DictCursor,
        connect_timeout=5,
    )


def _hash_password(pw):
    return hashlib.md5(pw.encode('utf-8')).hexdigest()


def _make_session_id():
    return hashlib.md5(os.urandom(32)).hexdigest()


_LOGIN_TEMPLATE = (
    b'<!DOCTYPE html><html><head><title>Archspace Login</title>'
    b'<style>'
    b'body{background:#000;color:#ccc;font-family:Arial,sans-serif;'
    b'display:flex;justify-content:center;align-items:center;height:100vh;margin:0}'
    b'.box{background:#111;border:1px solid #444;padding:30px;border-radius:4px;min-width:320px}'
    b'h2{color:#88f;margin-top:0}'
    b'label{font-size:.85em;color:#aaa}'
    b'input{width:100%;padding:8px;margin:4px 0 14px;'
    b'background:#222;border:1px solid #555;color:#fff;box-sizing:border-box}'
    b'.btn{background:#336;color:#fff;border:none;padding:10px;cursor:pointer;'
    b'width:100%;font-size:1em}'
    b'.err{color:#f66;margin-bottom:10px;font-size:.9em}'
    b'.link{text-align:center;margin-top:14px;font-size:.85em}'
    b'a{color:#88f}'
    b'</style></head>'
    b'<body><div class="box">'
    b'<h2>Archspace</h2>'
    b'@@MSG@@'
    b'<form method="post" action="/login">'
    b'<label>Username</label><input type="text" name="username" autofocus>'
    b'<label>Password</label><input type="password" name="password">'
    b'<input class="btn" type="submit" value="Login">'
    b'</form>'
    b'<div class="link"><a href="/register">Create account</a></div>'
    b'</div></body></html>'
)

_REGISTER_TEMPLATE = (
    b'<!DOCTYPE html><html><head><title>Archspace Register</title>'
    b'<style>'
    b'body{background:#000;color:#ccc;font-family:Arial,sans-serif;'
    b'display:flex;justify-content:center;align-items:center;height:100vh;margin:0}'
    b'.box{background:#111;border:1px solid #444;padding:30px;border-radius:4px;min-width:320px}'
    b'h2{color:#88f;margin-top:0}'
    b'label{font-size:.85em;color:#aaa}'
    b'input{width:100%;padding:8px;margin:4px 0 14px;'
    b'background:#222;border:1px solid #555;color:#fff;box-sizing:border-box}'
    b'.btn{background:#336;color:#fff;border:none;padding:10px;cursor:pointer;'
    b'width:100%;font-size:1em}'
    b'.err{color:#f66;margin-bottom:10px;font-size:.9em}'
    b'.ok{color:#6f6;margin-bottom:10px;font-size:.9em}'
    b'.link{text-align:center;margin-top:14px;font-size:.85em}'
    b'a{color:#88f}'
    b'</style></head>'
    b'<body><div class="box">'
    b'<h2>Create Account</h2>'
    b'@@MSG@@'
    b'<form method="post" action="/register">'
    b'<label>Username</label><input type="text" name="username" autofocus>'
    b'<label>Password</label><input type="password" name="password">'
    b'<label>Email</label><input type="email" name="email">'
    b'<input class="btn" type="submit" value="Register">'
    b'</form>'
    b'<div class="link"><a href="/login">Back to login</a></div>'
    b'</div></body></html>'
)


def LOGIN_PAGE(msg=b''):
    return _LOGIN_TEMPLATE.replace(b'@@MSG@@', msg)


def REGISTER_PAGE(msg=b''):
    return _REGISTER_TEMPLATE.replace(b'@@MSG@@', msg)


class ProxyHandler(BaseHTTPRequestHandler):
    server_version = 'ArchspaceProxy/1.0'

    def log_message(self, fmt, *args):
        pass  # silent

    def _write_response(self, code, body, content_type='text/html; charset=utf-8', extra_headers=None):
        self.send_response(code)
        self.send_header('Content-Type', content_type)
        self.send_header('Content-Length', str(len(body)))
        if extra_headers:
            for k, v in extra_headers.items():
                self.send_header(k, v)
        self.end_headers()
        self.wfile.write(body)

    def _serve_static(self, path):
        """Serve a static file from WEB_ROOT. Returns True if handled
        (including placeholders for missing assets — prevents them from
        being proxied to the game server which would return HTML junk)."""
        ext = os.path.splitext(path)[1].lower()
        if ext not in MIME_TYPES:
            return False
        # Strip leading slash and resolve safely within WEB_ROOT
        rel = path.lstrip('/')
        full = os.path.realpath(os.path.join(WEB_ROOT, rel))
        if not full.startswith(os.path.realpath(WEB_ROOT)):
            return False  # path traversal attempt
        if os.path.isfile(full):
            with open(full, 'rb') as f:
                data = f.read()
            self._write_response(200, data, MIME_TYPES[ext])
        elif ext in _IMAGE_EXTS:
            # Missing image → labelled SVG placeholder so users can see/click buttons
            svg_data = _make_placeholder_svg(path)
            self._write_response(200, svg_data, 'image/svg+xml')
        else:
            # Missing CSS/JS → empty 404 (browser handles gracefully)
            self._write_response(404, b'', MIME_TYPES[ext])
        return True

    def _redirect(self, location):
        self.send_response(302)
        self.send_header('Location', location)
        self.end_headers()

    def _do_menu(self):
        """Serve the left navigation frame (menu.as with base target fix)."""
        headers_dict = {k: self.headers[k] for k in self.headers}
        if not headers_dict.get('Referer'):
            host = headers_dict.get('Host', f'localhost:{PROXY_PORT}')
            headers_dict['Referer'] = f'http://{host}/'
        try:
            content, _cookie = proxy_to_archspace(
                'GET', '/archspace/menu.as', '', headers_dict,
                self.client_address[0])
            # Inject <base target="contents"> so tree-nav links open in main frame
            if b'<head>' in content.lower():
                content = content.replace(
                    b'<head>', b'<head><base target="contents">', 1)
                content = content.replace(
                    b'<HEAD>', b'<HEAD><base target="contents">', 1)
            else:
                content = b'<base target="contents">' + content
            # Rewrite localhost:12345 URLs
            browser_host = headers_dict.get('Host', f'localhost:{PROXY_PORT}')
            proto = headers_dict.get('X-Forwarded-Proto', 'http')
            content = content.replace(
                b'http://localhost:12345/',
                f'{proto}://{browser_host}/'.encode('latin-1'))
            self._write_response(200, content, 'text/html; charset=iso-8859-1')
        except Exception as e:
            self._write_response(502, f'<html><body>Menu error: {e}</body></html>'.encode())

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path, query = parsed.path, parsed.query

        # ── Frameset entry points ────────────────────────────────────────────
        if path in ('/', '/index.html', '/index.htm', '/index.phtml',
                    '/index.php', '/archspace', '/archspace/'):
            # If the user isn't logged in yet, show login page full-screen.
            # Once logged in, they can reload to get the frameset.
            cookie = self.headers.get('Cookie', '')
            if 'phpbb2mysql_sid=' in cookie:
                self._write_response(200, _FRAMESET_HTML,
                                     'text/html; charset=iso-8859-1')
            else:
                self._write_response(200, LOGIN_PAGE())
            return

        # ── Frame assets ─────────────────────────────────────────────────────
        if path == '/up.html':
            self._write_response(200, _UP_FRAME_HTML, 'text/html; charset=iso-8859-1')
            return
        if path == '/left.html':
            self._do_menu()
            return

        # ── Auth pages ───────────────────────────────────────────────────────
        if path == '/register':
            self._write_response(200, REGISTER_PAGE())
        elif path == '/login':
            self._write_response(200, LOGIN_PAGE())
        elif path == '/main.phtml':
            self._redirect('/archspace/login.as')
        elif self._serve_static(path):
            pass  # handled
        else:
            self._do_proxy('GET', path, query)

    def do_POST(self):
        length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(length) if length else b''
        parsed = urllib.parse.urlparse(self.path)
        path, query = parsed.path, parsed.query
        if path == '/login':
            self._handle_login(body)
        elif path == '/register':
            self._handle_register(body)
        else:
            # Merge POST body into query string for the game server
            body_str = body.decode('latin-1', errors='replace')
            if query:
                query = query + '&' + body_str
            else:
                query = body_str
            self._do_proxy('POST', path, query)

    def _handle_login(self, body):
        params = urllib.parse.parse_qs(body.decode('utf-8', errors='replace'))
        username = params.get('username', [''])[0].strip()
        password = params.get('password', [''])[0]
        if not username or not password:
            self._write_response(200, LOGIN_PAGE(b'<div class="err">Username and password required.</div>'))
            return
        try:
            db = _get_db()
            with db.cursor() as cur:
                cur.execute(
                    'SELECT user_id, user_password FROM asbb_users WHERE username=%s LIMIT 1',
                    (username,)
                )
                row = cur.fetchone()
            if not row:
                db.close()
                self._write_response(200, LOGIN_PAGE(b'<div class="err">Invalid username or password.</div>'))
                return
            stored = row['user_password']
            if password != stored and _hash_password(password) != stored:
                db.close()
                self._write_response(200, LOGIN_PAGE(b'<div class="err">Invalid username or password.</div>'))
                return
            session_id = _make_session_id()
            now = int(time.time())
            with db.cursor() as cur:
                cur.execute('DELETE FROM asbb_sessions WHERE session_user_id=%s', (row['user_id'],))
                cur.execute(
                    'INSERT INTO asbb_sessions (session_id, session_user_id, session_time) VALUES (%s,%s,%s)',
                    (session_id, row['user_id'], now)
                )
                cur.execute('UPDATE asbb_users SET user_session_time=%s WHERE user_id=%s', (now, row['user_id']))
            db.commit()
            db.close()
            self.send_response(302)
            self.send_header('Location', '/')   # → frameset
            self.send_header('Set-Cookie', f'phpbb2mysql_sid={session_id}; path=/')
            self.end_headers()
        except Exception as e:
            msg = f'<div class="err">Database error: {e}</div>'.encode()
            self._write_response(500, LOGIN_PAGE(msg))

    def _handle_register(self, body):
        params = urllib.parse.parse_qs(body.decode('utf-8', errors='replace'))
        username = params.get('username', [''])[0].strip()
        password = params.get('password', [''])[0]
        email = params.get('email', [''])[0].strip()
        if not username or not password:
            self._write_response(200, REGISTER_PAGE(b'<div class="err">Username and password required.</div>'))
            return
        try:
            db = _get_db()
            with db.cursor() as cur:
                cur.execute('SELECT user_id FROM asbb_users WHERE username=%s LIMIT 1', (username,))
                if cur.fetchone():
                    db.close()
                    self._write_response(200, REGISTER_PAGE(b'<div class="err">Username already taken.</div>'))
                    return
                hashed = _hash_password(password)
                cur.execute(
                    'INSERT INTO asbb_users (username, user_password, user_email) VALUES (%s,%s,%s)',
                    (username, hashed, email)
                )
                user_id = cur.lastrowid
                session_id = _make_session_id()
                now = int(time.time())
                cur.execute(
                    'INSERT INTO asbb_sessions (session_id, session_user_id, session_time) VALUES (%s,%s,%s)',
                    (session_id, user_id, now)
                )
                cur.execute('UPDATE asbb_users SET user_session_time=%s WHERE user_id=%s', (now, user_id))
            db.commit()
            db.close()
            # Redirect to frameset; content frame will load login.as which
            # detects no character and shows create character link
            self.send_response(302)
            self.send_header('Location', '/archspace/create.as')
            self.send_header('Set-Cookie', f'phpbb2mysql_sid={session_id}; path=/')
            self.end_headers()
        except Exception as e:
            msg = f'<div class="err">Registration error: {e}</div>'.encode()
            self._write_response(500, REGISTER_PAGE(msg))

    def _do_proxy(self, method, path, query):
        client_ip = self.client_address[0]
        headers_dict = {k: self.headers[k] for k in self.headers}
        # check_referrer() in common.cc requires Referer to start with "http://{host_name}".
        # Browsers don't send Referer for direct navigation, so inject one.
        if not headers_dict.get('Referer'):
            host = headers_dict.get('Host', f'localhost:{PROXY_PORT}')
            headers_dict['Referer'] = f'http://{host}/'
        try:
            content, set_cookie = proxy_to_archspace(method, path, query, headers_dict, client_ip)
            extra = {}
            if set_cookie:
                extra['Set-Cookie'] = set_cookie + '; path=/'
            # Rewrite game-server image/resource URLs so the browser hits the proxy
            # instead of the raw binary-CGI port (localhost:12345 doesn't speak HTTP).
            # Respect X-Forwarded-Proto so ngrok/reverse-proxy HTTPS links work.
            browser_host = headers_dict.get('Host', f'localhost:{PROXY_PORT}')
            proto = headers_dict.get('X-Forwarded-Proto', 'http')
            content = content.replace(
                b'http://localhost:12345/',
                f'{proto}://{browser_host}/'.encode('latin-1')
            )
            content_type = 'text/html; charset=euc-kr'
            self._write_response(200, content, content_type, extra)
        except Exception as e:
            error = f'<html><body style="background:#000;color:#f88"><h2>Proxy Error</h2><pre>{e}</pre></body></html>'.encode()
            self._write_response(502, error)


if __name__ == '__main__':
    import sys
    print(f'Archspace HTTP proxy starting on :{PROXY_PORT}', flush=True)
    print(f'  Archspace backend: {ARCHSPACE_HOST}:{ARCHSPACE_PORT}', flush=True)
    print(f'  MySQL: {DB_HOST}/{DB_NAME}', flush=True)
    server = HTTPServer(('0.0.0.0', PROXY_PORT), ProxyHandler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print('Shutting down.', flush=True)
        sys.exit(0)
