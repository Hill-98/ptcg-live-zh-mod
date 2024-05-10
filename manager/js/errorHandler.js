window.errorHandler = function errorHandler(e) {
    console.error(e);
    debugger;
    if (e instanceof Error) {
        alert(e.stack);
    } else if (e instanceof ErrorEvent) {
        alert(e.error.stack);
    } else {
        alert(e);
    }
};

window.addEventListener('error', function (event) {
    window.errorHandler(event);
});
