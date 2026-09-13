(function () {
  var FORM_ID = 'mqpkqbpy';
  var form = document.getElementById('contact-form');
  if (!form) return;

  var submitBtn = document.getElementById('contact-submit');
  var formError = document.getElementById('contact-form-error');
  var card = document.getElementById('contact-card');
  var successView = document.getElementById('contact-success');

  var clearErrors = function () {
    form.querySelectorAll('.field').forEach(function (f) { f.classList.remove('has-error'); });
    form.querySelectorAll('[data-error-for]').forEach(function (e) { e.textContent = ''; });
    formError.style.display = 'none';
  };

  var showFieldError = function (field, message) {
    var el = form.querySelector('[data-error-for="' + field + '"]');
    if (el) {
      el.textContent = message;
      var wrapper = el.closest('.field');
      if (wrapper) wrapper.classList.add('has-error');
    }
  };

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    clearErrors();
    submitBtn.disabled = true;
    submitBtn.textContent = 'Sending...';

    var data = {
      name: form.name.value,
      email: form.email.value,
      source: form.source.value,
      message: form.message.value,
    };

    fetch('https://formspree.io/f/' + FORM_ID, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(data),
    })
      .then(function (res) {
        return res.json().then(function (body) { return { ok: res.ok, body: body }; });
      })
      .then(function (result) {
        if (result.ok) {
          form.style.display = 'none';
          successView.style.display = 'block';
        } else {
          var errors = (result.body && result.body.errors) || [];
          if (errors.length) {
            errors.forEach(function (err) {
              if (err.field) showFieldError(err.field, err.message);
              else {
                formError.textContent = err.message || 'Something went wrong. Please try again.';
                formError.style.display = 'block';
              }
            });
          } else {
            formError.style.display = 'block';
          }
          submitBtn.disabled = false;
          submitBtn.textContent = 'Submit';
        }
      })
      .catch(function () {
        formError.style.display = 'block';
        submitBtn.disabled = false;
        submitBtn.textContent = 'Submit';
      });
  });
})();
