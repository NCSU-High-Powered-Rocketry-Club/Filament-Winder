// All of the Node.js APIs are available in the preload process.
// It has the same sandbox as a Chrome extension.
window.addEventListener("DOMContentLoaded", function () {
    var _a;
    var replaceText = function (selector, text) {
        var element = document.getElementById(selector);
        if (element) {
            element.innerText = text;
        }
    };
    for (var _i = 0, _b = ["chrome", "node", "electron"]; _i < _b.length; _i++) {
        var type = _b[_i];
        replaceText("".concat(type, "-version"), (_a = process.versions[type]) !== null && _a !== void 0 ? _a : "");
    }
});
//# sourceMappingURL=preload.js.map