// yahoo.js — YUI 2.x stub
var YAHOO = YAHOO || {};
YAHOO.util = YAHOO.util || {};
YAHOO.widget = YAHOO.widget || {};

// Event utility
YAHOO.util.Event = {
    addListener: function(el, type, fn) {
        var target = (el === window) ? window : (typeof el === 'string' ? document.getElementById(el) : el);
        if (!target) return;
        if (target.addEventListener) {
            target.addEventListener(type, fn, false);
        } else if (target.attachEvent) {
            target.attachEvent('on' + type, fn);
        }
    },
    on: function(el, type, fn) { this.addListener(el, type, fn); }
};

// Tooltip stub (not used but referenced)
YAHOO.widget.Tooltip = function(){return{render:function(){},show:function(){},hide:function(){}}};
