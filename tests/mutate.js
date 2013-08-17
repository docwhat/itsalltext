window.iat = (function () {
  return {
    parent_id: 'test',
    counter: 0,
    makeOne: function () {
      var parent = document.getElementById(iat.parent_id);
      while (parent.hasChildNodes()) {
        parent.removeChild(parent.firstChild);
      }
      var ta = document.createElement('textarea');
      ta.id = 'textarea-' + iat.counter;
      ta.value = 'Textarea ' + iat.counter;
      iat.counter++;
      parent.appendChild(ta);
    },
    make: function (n) {
      n = !n ? 1 : n;
      var i, r;
      for(i = 0; i <= n; i++) {
        iat.makeOne();
      }
    },
  };
})();
