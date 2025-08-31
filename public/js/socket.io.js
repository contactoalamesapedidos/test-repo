// Socket.IO CDN fallback loader
(function() {
  if (typeof io === 'undefined') {
    var script = document.createElement('script');
    script.src = '/socket.io/socket.io.js';
    script.onload = function() {
      console.log('Socket.IO client loaded from /socket.io/socket.io.js');
    };
    script.onerror = function() {
      console.error('No se pudo cargar Socket.IO client. El chat no funcionará.');
    };
    document.head.appendChild(script);
  }
})();
