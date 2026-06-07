#!/usr/bin/env python3
"""
spawn_ai_players.py — Seed the Vibespace database with passive AI target players.

Each AI player gets:
  • 5–20 planets
  • 1 ship design (Corvette-class with Titanium/Retro components)
  • 1 fleet of 10–20 Corvettes

Usage (run inside the Docker network):
  docker run --rm --network vibespace_default \\
    -e DB_HOST=db -e DB_USER=archspace -e DB_PASS=archspace -e DB_NAME=Archspace2 \\
    -v ~/MagellanWars/spawn_ai_players.py:/spawn.py \\
    python:3.11-slim bash -c "pip install pymysql -q && python /spawn.py"
"""

import pymysql
import os
import random
import hashlib
import time

# ── Config ────────────────────────────────────────────────────────────────────

DB_HOST = os.environ.get('DB_HOST', 'db')
DB_USER = os.environ.get('DB_USER', 'archspace')
DB_PASS = os.environ.get('DB_PASS', 'archspace')
DB_NAME = os.environ.get('DB_NAME', 'Archspace2')

AI_COUNT          = 100
AI_PORTAL_ID_BASE = 100000   # portal IDs for AI: 100000+ (won't clash with real users)

PLANET_MIN = 5
PLANET_MAX = 20

FLEET_SHIPS_MIN = 10
FLEET_SHIPS_MAX = 20

# Component IDs (from component.en)
# Only 5101 (Titanium) and 5401 (Retro) have no tech prerequisites;
# others are assigned directly in the DB — prereq checks only happen in the UI.
COMP_ARMOR    = 5101   # Titanium (no prereq)
COMP_ENGINE   = 5401   # Retro    (no prereq)
COMP_COMPUTER = 5201   # Electronic Computer
COMP_SHIELD   = 5301   # Electromagnetic Shield
COMP_WEAPON   = 6101   # Laser (beam)

# Ship body IDs (from ship.en)
SHIP_GUNBOAT  = 4001   # class 1, 1 weapon slot
SHIP_CORVETTE = 4002   # class 2, 2 weapon slots

# Races 1–10
RACES = list(range(1, 11))

# 100 sci-fi player names
AI_NAMES = [
    "Zyr'koth", "Vel'narix", "Theron Vance", "Ix'dara", "Kalix Dorn",
    "Nerix Solan", "Draxa Morn", "Lyren Voss", "Torval Krex", "Sevik Naal",
    "Myra Tessen", "Kord Ulven", "Phasix Draal", "Uxar Kelm", "Bryn Ortav",
    "Corven Skyx", "Talrix Bane", "Zephon Ulk", "Niral Vex", "Darex Kuur",
    "Yven Straal", "Gorn Axivek", "Trelix Norn", "Uvrak Seld", "Pyrex Dhal",
    "Kelvan Strex", "Xorven Nisk", "Relix Torr", "Myvek Dran", "Solax Krenn",
    "Jyrek Vaal", "Toven Skral", "Nexar Dyrn", "Alvek Torr", "Cyrix Naal",
    "Draven Skoll", "Pyroth Venx", "Ulrix Dorn", "Zeven Maal", "Korvin Stek",
    "Xevrik Norn", "Talyn Vrex", "Brek Solix", "Myven Tork", "Ralyx Davn",
    "Sorven Keld", "Tryx Noval", "Kelvex Dorn", "Pyrax Streln", "Noven Trix",
    "Alvon Skex", "Drex Yuval", "Zerik Norv", "Torven Skaal", "Xalyx Dren",
    "Korex Mavn", "Ryven Tolk", "Nexal Drix", "Jurek Straal", "Valyx Norv",
    "Pyrek Skold", "Toven Zrix", "Xelyx Durn", "Kovran Stell", "Ryvex Norn",
    "Dryx Torval", "Zelvik Orn", "Morix Taven", "Pyrven Skell", "Tarex Durn",
    "Xovrek Naal", "Kelvyn Strix", "Bravex Dorn", "Selyn Torv", "Pyrox Veld",
    "Norven Skex", "Talarix Dren", "Xevyx Norn", "Korvex Daal", "Rylex Strunk",
    "Zelryx Dorn", "Mavex Tokk", "Pyrvel Nork", "Toryx Skarl", "Xolvek Dren",
    "Krevyn Norsk", "Draven Yx", "Zerak Molvn", "Tyvex Dorn", "Rolvek Naax",
    "Pyrven Stolk", "Xarix Dren", "Kovex Tyrn", "Norvex Skaal", "Talex Dorn",
    "Zelvik Norx", "Myrex Strunk", "Dravex Keld", "Toven Ryxx", "Xalven Dorn",
]

PLANET_PREFIXES = [
    "Alpha", "Beta", "Gamma", "Delta", "Sigma", "Omega", "Zeta", "Theta",
    "Vega", "Orion", "Lyra", "Draco", "Aquila", "Corvus", "Hydra", "Lupus",
]
PLANET_SUFFIXES = [
    "Prime", "Secundus", "Major", "Minor", "Rex", "Nova", "Vex", "Norn",
    "Deep", "Far", "Dark", "Bright", "Storm", "Calm", "Void", "Edge",
]

def planet_name():
    return f"{random.choice(PLANET_PREFIXES)} {random.choice(PLANET_SUFFIXES)} {random.randint(1,9)}"

def connect():
    return pymysql.connect(
        host=DB_HOST, user=DB_USER, password=DB_PASS,
        database=DB_NAME, charset='latin1',
        cursorclass=pymysql.cursors.DictCursor,
        autocommit=False,
    )

def insert_planet(cur, planet_id, cluster_id, owner, order_, pop=None):
    """Insert one planet record."""
    if pop is None:
        pop = random.randint(20000, 80000)
    factories = random.randint(1, 4)
    mil_bases = random.randint(0, 2)
    research  = random.randint(0, 2)
    atmo = random.choice(['OXYGEN', 'OXYGEN', 'OXYGEN', 'METHANE', 'AMMONIA'])
    size = random.randint(1, 4)
    resource = random.randint(1, 4)
    cur.execute("""
        INSERT INTO planet (
            id, cluster, owner, order_,
            name, attribute,
            population,
            building_factory, building_military_base, building_research_lab,
            progress_factory, progress_military_base, progress_research_lab,
            ratio_factory, ratio_military_base, ratio_research_lab,
            atmosphere, temperature, size, resource, gravity,
            investment, terraforming, terraforming_timer,
            commerce_with_1, commerce_with_2, commerce_with_3,
            privateer_timer, blockade_timer,
            news_population, news_factory
        ) VALUES (
            %s, %s, %s, %s,
            %s, '',
            %s,
            %s, %s, %s,
            0, 0, 0,
            40, 30, 30,
            %s, 300, %s, %s, 1.0,
            0, 0, 0,
            0, 0, 0,
            0, 0,
            %s, %s
        )
    """, (planet_id, cluster_id, owner, order_,
          planet_name(),
          pop,
          factories, mil_bases, research,
          atmo, size, resource,
          pop, factories))


def insert_ship_design(cur, owner, design_id):
    """Insert a Corvette-class ship design with basic components."""
    cur.execute("""
        INSERT INTO class (
            owner, design_id, name, body,
            armor, engine, computer, shield,
            weapon1, weapon2, weapon3, weapon4, weapon5,
            weapon6, weapon7, weapon8, weapon9, weapon10,
            weapon_number1, weapon_number2, weapon_number3, weapon_number4, weapon_number5,
            weapon_number6, weapon_number7, weapon_number8, weapon_number9, weapon_number10,
            device1, device2, device3, device4,
            device5, device6, device7, device8,
            time, cost,
            black_market_design, empire_design
        ) VALUES (
            %s, %s, 'Strike Corvette', %s,
            %s, %s, %s, %s,
            %s, %s, 0, 0, 0,
            0, 0, 0, 0, 0,
            1, 1, 0, 0, 0,
            0, 0, 0, 0, 0,
            0, 0, 0, 0,
            0, 0, 0, 0,
            200, 309,
            0, 0
        )
    """, (owner, design_id, SHIP_CORVETTE,
          COMP_ARMOR, COMP_ENGINE, COMP_COMPUTER, COMP_SHIELD,
          COMP_WEAPON, COMP_WEAPON))   # two laser weapons for Corvette (2 weapon slots)


def insert_fleet(cur, owner, fleet_id, design_id, fleet_size):
    """Insert one fleet record."""
    fleet_name = random.choice([
        "Vanguard", "Strike Force", "Iron Fist", "Dark Wing",
        "Storm Fleet", "Shadow Squadron", "Void Raiders", "Iron Claw",
        "Star Wolves", "Nebula Guard",
    ])
    cur.execute("""
        INSERT INTO fleet (
            owner, id, name,
            admiral, exp, status,
            maxship, currentship, shipclass,
            mission, mission_target, mission_terminate_time,
            killed_ship, killed_fleet
        ) VALUES (
            %s, %s, %s,
            -1, 0, 0,
            %s, %s, %s,
            0, 0, 0,
            0, 0
        )
    """, (owner, fleet_id, fleet_name,
          fleet_size, fleet_size, design_id))


def main():
    db = connect()
    cur = db.cursor()

    # ── Fetch existing state ──────────────────────────────────────────────────

    cur.execute("SELECT id FROM cluster ORDER BY id")
    clusters = [r['id'] for r in cur.fetchall()]
    if not clusters:
        print("ERROR: No clusters found. Has the game started?")
        return

    cur.execute("SELECT id FROM council WHERE auto_assign=1 ORDER BY id")
    councils = [r['id'] for r in cur.fetchall()]
    if not councils:
        print("ERROR: No auto-assign councils found.")
        return

    cur.execute("SELECT MAX(game_id) as m FROM player")
    max_game_id = (cur.fetchone()['m'] or 0)

    cur.execute("SELECT MAX(id) as m FROM planet")
    max_planet_id = (cur.fetchone()['m'] or 0)

    cur.execute("SELECT MAX(user_id) as m FROM asbb_users")
    max_user_id = (cur.fetchone()['m'] or 0)

    # Check how many AI players already exist
    cur.execute("SELECT COUNT(*) as c FROM asbb_users WHERE username LIKE 'ai\\_%'")
    existing = cur.fetchone()['c']
    if existing > 0:
        print(f"WARNING: {existing} AI players already exist. Adding more on top.")

    print(f"Clusters: {clusters}")
    print(f"Councils: {councils}")
    print(f"Max game_id: {max_game_id}, max planet_id: {max_planet_id}")
    print(f"Spawning {AI_COUNT} AI players with {PLANET_MIN}–{PLANET_MAX} planets each...")

    game_time    = int(time.time())
    next_planet_id = max_planet_id + 1

    for i in range(AI_COUNT):
        game_id    = max_game_id + 1 + i
        portal_id  = AI_PORTAL_ID_BASE + max_user_id + i
        cluster_id = random.choice(clusters)
        council_id = random.choice(councils)
        race       = random.choice(RACES)

        # Pick a unique display name
        name = AI_NAMES[i % len(AI_NAMES)]
        suffix = i // len(AI_NAMES)
        if suffix > 0:
            name = f"{name} {suffix+1}"

        # ── Portal user (can't log in — password is random garbage) ──────────
        portal_username = f"ai_{game_id}"
        portal_password = hashlib.md5(os.urandom(32)).hexdigest()
        cur.execute("""
            INSERT INTO asbb_users
              (username, user_password, user_email, user_level, firstlogin, ip)
            VALUES (%s, %s, %s, 'PLAYER', %s, '0.0.0.0')
        """, (portal_username, portal_password,
              f"{portal_username}@ai.internal", game_time))
        actual_portal_id = db.insert_id()

        # ── Player record ─────────────────────────────────────────────────────
        cur.execute("""
            INSERT INTO player (
                game_id, portal_id, name, home_cluster_id,
                last_login, last_login_ip,
                mode, race, honor,
                research_invest, tick, turn,
                production, ship_production, invested_ship_production, research,
                ability, research_tech,
                admiral_timer,
                last_turn_production, last_turn_research, last_turn_military,
                council_id, council_vote, council_production, council_donation,
                security_level, alertness, empire_relation,
                protected_mode, protected_terminate_time,
                news_turn, news_production, news_research, news_population,
                news_ability,
                planet_invest_pool, admission_time_limit, honor_timer, rating
            ) VALUES (
                %s, %s, %s, %s,
                %s, '0.0.0.0',
                0, %s, 50,
                30, %s, 0,
                0, 0, 0, 0,
                '', 1,
                %s,
                0, 0, 0,
                %s, 0, 0, 0,
                1, 0, 50,
                0, -1,
                0, 0, 0, 0,
                '',
                0, -1, %s, 2000
            )
        """, (
            game_id, actual_portal_id, name, cluster_id,
            game_time,
            race,
            game_time,   # tick
            game_time,   # admiral_timer
            council_id,
            game_time,   # honor_timer
        ))

        # ── Planets (5–20) ────────────────────────────────────────────────────
        num_planets = random.randint(PLANET_MIN, PLANET_MAX)
        for p in range(num_planets):
            # Spread planets across clusters; home planet stays in home cluster
            p_cluster = cluster_id if p == 0 else random.choice(clusters)
            p_pop = random.randint(30000, 100000) if p == 0 else random.randint(10000, 70000)
            insert_planet(cur, next_planet_id, p_cluster, game_id, p + 1, p_pop)
            next_planet_id += 1

        # ── Ship design ───────────────────────────────────────────────────────
        design_id = 1
        insert_ship_design(cur, game_id, design_id)

        # ── Fleet ─────────────────────────────────────────────────────────────
        fleet_size = random.randint(FLEET_SHIPS_MIN, FLEET_SHIPS_MAX)
        insert_fleet(cur, game_id, 1, design_id, fleet_size)

        if (i + 1) % 10 == 0:
            db.commit()
            print(f"  {i+1}/{AI_COUNT} players created...")

    db.commit()
    print(f"\nDone! {AI_COUNT} AI players spawned.")
    print("Restart the archspace container to load them:")
    print("  docker compose restart archspace")
    cur.close()
    db.close()

if __name__ == '__main__':
    main()
