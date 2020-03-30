function ToneJsLibrary(Tone, defLength, Placeholder) {

  var synth = null;
  var defLength = defLength || '4n';

  function getSynth() {
    synth = synth || new Tone.Synth().toDestination();
    return synth;
  }

  function playNote(source, length) {
    if (Array.isArray(source)) {
      if (source.length > 0) {
        getSynth().triggerAttackRelease(
          source[0],
          source.length > 1 ? source[1] : defLength
        );
      }
    } else if (source.pitch) {
      getSynth().triggerAttackRelease(source.pitch, source.length || length || '4n');
    } else if (source) {
      getSynth().triggerAttackRelease(source, length || '4n');
    }
  }

  function playMusic(notes) {
    if (Array.isArray(notes)) {
      if (notes.length === 2 && /^\d/.test(notes[1])) {
        playNote(notes);
      } else {
        Tone.Transport.stop();
        Tone.Transport.position = 0;
        Tone.Transport.cancel();
        let pattern = new Tone.Pattern(function (time, note) {
          playNote(note);
        }, notes);
        pattern.iterations = notes.length;
        pattern.start(0);
        Tone.Transport.start();
      }
    } else {
      playNote(notes);
    }
  }

  document.querySelectorAll('.tone-keyboard button').forEach(function (button) {
    button.addEventListener('click', function (event) {
      playNote(event.target.getAttribute('id'));
    });
  });

  document.querySelectorAll('.tone-play-sequence').forEach(function (button) {
    button.addEventListener('click', function (event) {
      playMusic(window.sequence);
    });
    button.disabled = window.sequence === undefined;
  });

  if (Placeholder) {
    Placeholder.noteHistory().forEach(function (pair) {
      playNote(pair[0], pair[1]);
    });
    Placeholder.musicHistory().forEach(function (notes) {
      playMusic(notes);
    });
  }

  return {
    playNote: playNote,
    playMusic: playMusic
  };
}

// Placeholder until hotloading of Tone.js is finished.
window.ToneJsLib = (function () {
  var noteSourceLengths = [];
  var musicNotes = [];
  return {
    playNote: function (source, length) {
      noteSourceLengths.push([source, length]);
    },
    playMusic: function (notes) {
      musicNotes.push(notes);
    },
    noteHistory: function () {
      return noteSourceLengths;
    },
    musicHistory: function() {
      return musicNotes;
    }
  };
})();

var script = document.createElement('script');
script.type = 'text/javascript';
script.src = 'https://cdnjs.cloudflare.com/ajax/libs/tone/14.5.37/Tone.min.js';
script.onload = function() {
  window.ToneJsLib = ToneJsLibrary(Tone, undefined, window.ToneJsLib);
};
document.getElementsByTagName('head')[0].appendChild(script);
