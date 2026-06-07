// ftiens4.js — Modern replacement for the classic FolderTree navigation library.
// Implements the same gFld/gLnk/insFld/insDoc/initializeDocument API that
// the Archspace menu.as page uses to build its tree navigation.
//
// Links inherit <base target="contents"> from the page so they open in the
// right-hand content frame automatically.

var USETEXTLINKS = 1;
var PRESERVESTATE = 1;
var USEICONS = 0;

function _TreeNode(type, name, url) {
    this.type     = type;   // 'folder' or 'doc'
    this.name     = name;
    this.url      = url || '';
    this.children = [];
    this.expanded = false;
}

// gFld(target, name, url) — creates a folder/section node
function gFld(target, name, url) {
    return new _TreeNode('folder', name, url);
}

// gLnk(target, name, url) — creates a leaf link node
function gLnk(target, name, url) {
    return new _TreeNode('doc', name, url);
}

// insFld(parent, child) — attaches child folder to parent, returns child
function insFld(parent, child) {
    if (parent && child) parent.children.push(child);
    return child;
}

// insDoc(parent, item) — attaches a doc/link to a folder
function insDoc(parent, item) {
    if (parent && item) parent.children.push(item);
    return item;
}

// ── Rendering ────────────────────────────────────────────────────────────────

function _renderNode(node, depth) {
    var html = '';
    if (node.type === 'folder') {
        var hasChildren = node.children.length > 0;
        var id = 'tf_' + Math.random().toString(36).slice(2);
        node._id = id;

        var arrow = hasChildren ? '<span class="tf-arrow">▶</span>' : '';
        var href  = node.url ? ' href="' + node.url + '"' : '';
        var indent = depth > 0 ? ' style="padding-left:' + (depth * 10) + 'px"' : '';

        if (depth === 0 && node.name === '') {
            // Root node — render children only
            for (var i = 0; i < node.children.length; i++) {
                html += _renderNode(node.children[i], 0);
            }
            return html;
        }

        html += '<div class="tf-folder"' + indent + '>';
        if (node.url) {
            html += '<a' + href + ' class="tf-folder-link">' + arrow + node.name + '</a>';
        } else {
            html += '<span class="tf-folder-link tf-no-url">' + arrow + node.name + '</span>';
        }

        if (hasChildren) {
            html += '<div class="tf-children" id="' + id + '" style="display:none">';
            for (var j = 0; j < node.children.length; j++) {
                html += _renderNode(node.children[j], depth + 1);
            }
            html += '</div>';
        }
        html += '</div>';

    } else {
        // doc / leaf link
        var dindent = ' style="padding-left:' + ((depth) * 10 + 4) + 'px"';
        html += '<div class="tf-doc"' + dindent + '>';
        html += '<a href="' + node.url + '" class="tf-doc-link">▸ ' + node.name + '</a>';
        html += '</div>';
    }
    return html;
}

function _attachToggle(container) {
    var folders = container.querySelectorAll('.tf-folder-link');
    for (var i = 0; i < folders.length; i++) {
        (function(el) {
            el.addEventListener('click', function(e) {
                var parent = el.parentNode;
                var children = parent.querySelector('.tf-children');
                var arrow    = el.querySelector('.tf-arrow');
                if (!children) return;   // folder with URL but no children
                e.preventDefault();
                var open = children.style.display !== 'none';
                children.style.display = open ? 'none' : 'block';
                if (arrow) arrow.textContent = open ? '▶' : '▼';
                // follow URL in contents frame if present
                if (!open && el.href && el.href !== window.location.href + '#') {
                    window.open(el.href, 'contents');
                }
            });
        })(folders[i]);
    }
}

function initializeDocument() {
    if (typeof foldersTree === 'undefined') return;

    var css = [
        '<style>',
        'body { background:#000; margin:4px; padding:0; font-family:Arial,sans-serif; font-size:11px; overflow-x:hidden; }',
        '.tf-folder { margin:0; padding:2px 0; }',
        '.tf-folder-link {',
        '  display:block; padding:3px 4px;',
        '  color:#7799bb; text-decoration:none; cursor:pointer;',
        '  white-space:nowrap; overflow:hidden; text-overflow:ellipsis;',
        '  font-weight:bold; letter-spacing:.5px;',
        '}',
        '.tf-folder-link:hover { color:#aaccff; background:#0d1530; }',
        '.tf-arrow { margin-right:4px; font-size:9px; display:inline-block; width:10px; }',
        '.tf-doc { margin:0; }',
        '.tf-doc-link {',
        '  display:block; padding:2px 4px;',
        '  color:#556688; text-decoration:none;',
        '  white-space:nowrap; overflow:hidden; text-overflow:ellipsis;',
        '}',
        '.tf-doc-link:hover { color:#99bbcc; background:#0a1020; }',
        '.tf-children { border-left:1px solid #1a2a44; margin-left:8px; }',
        '</style>'
    ].join('\n');

    var html = _renderNode(foldersTree, 0);
    document.write(css + html);

    // Attach toggle handlers once DOM is ready
    (function attach() {
        if (!document.body) { setTimeout(attach, 50); return; }
        _attachToggle(document.body);
    })();
}
