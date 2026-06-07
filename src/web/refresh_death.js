// refresh_death.js - death screen auto-refresh (same as refresh.js)
var _refresh_timer = null;

function refresh_init(seconds) {
    if (seconds > 0) {
        _refresh_timer = setTimeout(function() {
            window.location.reload();
        }, seconds * 1000);
    }
}

function refresh_stop() {
    if (_refresh_timer) {
        clearTimeout(_refresh_timer);
        _refresh_timer = null;
    }
}
