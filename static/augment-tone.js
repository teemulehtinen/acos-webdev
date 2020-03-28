
var script = document.createElement('script');
script.type = 'text/javascript';
script.src = 'https://cdnjs.cloudflare.com/ajax/libs/tone/14.5.37/Tone.min.js';
script.onload = function() {

  let synth = null;
  function getSynth() {
    synth = synth || new Tone.Synth().toDestination();
    return synth;
  }

  document.querySelectorAll('.tone-keyboard button').forEach(function (button) {
    button.addEventListener('click', function (event) {
      let id = event.target.getAttribute('id');
      if (id !== null) {
        getSynth().triggerAttackRelease(id, '4n');
      }
    });
  });

  document.querySelectorAll('.tone-play-sequence').forEach(function (button) {
    button.addEventListener('click', function (event) {
      let synth = getSynth();
      Tone.Transport.stop();
      Tone.Transport.position = 0;
      Tone.Transport.cancel();
      let pattern = new Tone.Pattern(function (time, note) {
        synth.triggerAttackRelease(note[0], note[1]);
      }, window["sequence"]);
      pattern.iterations = sequence.length;
      pattern.start(0);
      Tone.Transport.start();
    });
    if (window["sequence"] === undefined || window["sequence"].length < 1) {
      button.disabled = true;
    }
  });

};
document.getElementsByTagName('head')[0].appendChild(script);
