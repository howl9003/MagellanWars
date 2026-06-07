// refresh.js - Archspace page auto-refresh
var _refresh_timer = null;

function refresh_init(seconds) {
    if (seconds > 0) {
        _refresh_timer = setTimeout(function() {
            window.location.reload();
        }, seconds * 1000);
    }
}

function refresh_init_for_portal(seconds) {
    // Portal version - same behaviour
    refresh_init(seconds);
}

function refresh_stop() {
    if (_refresh_timer) {
        clearTimeout(_refresh_timer);
        _refresh_timer = null;
    }
}
