/* global ACOS */
/* jshint globalstrict: true */

"use strict";

function ACOSWebdev($element, config, points) {
  this.$element = $element;
  this.config = config;
  this.config.points = points;
  this.session = this.uuid();
  this.logStore = [];
  this.logQueue = 0;
  this.touched = false;
  var self = this;

  if (config.mutationObserver && !config.replay) {
    let observer = new MutationObserver(function (mutations) {
      mutations.forEach(function (mutation) {
        var n = mutation.type == 'characterData' ? mutation.target.parentNode : mutation.target;
        self.log({ type: mutation.type, changed: n.outerHTML });
      });
      if (self.config.mutations && !self.config.triggerButton) {
        self.grade(mutations);
      }
    });
    observer.observe($element.find('.exercise').get(0), {
      attributes: true,
      childList: true,
      characterData: true,
      subtree: true
    });
  }

  self.reset(true);

  if (config.triggerButton && !config.replay) {
    $element.find('.toolbox .trigger-button').on('click', function (event) {
      self.grade(event);
    });
  }
  if (config.resetButton && !config.replay) {
    $element.find('.toolbox .reset-button').on('click', function (event) {
      self.reset(true);
    });
  }

  $element.on('click', function (event) {
    self.log({
      type: 'mouseClick',
      x: event.clientX,
      y: event.clientY,
      target: event.target.localName
    });
    self.touched = true;
  });
  window.onblur = function (event) {
    if (self.touched) {
      self.log({ type: 'windowBlur' }, true);
    }
  };
  window.onfocus = function (event) {
    if (self.touched) {
      self.log({ type: 'windowFocus' }, true);
    }
  };
  window.addEventListener('beforeunload', function (event) {
    self.store('unload');
  });
};

ACOSWebdev.prototype.log = function (entry, noStore) {
  entry.time = new Date().getTime();
  this.logStore.push(entry);
  this.logQueue++;
  if (noStore === undefined && this.logQueue > 4) {
    this.store('logqueue');
    this.logQueue = 0;
  }
};

ACOSWebdev.prototype.reset = function (initial) {
  var $element = this.$element;
  var config = this.config;
  var self = this;
  this.log({ type: 'reset' }, true);

  // Populate problem data.
  $element.find('.instructions').html(config.instructions);
  $element.find('.toolbox .feedback').empty();
  this.updatePointsDisplay(0);
  $element.find('.exercise').html(config.html);

  this.extendReset(initial);

  // Add configured event listener.
  if (config.selector && config.events && !config.triggerButton && !config.replay) {
    let $selected = config.selector == '$window' ? $(window) : $element.find(config.selector);
    $selected.on(config.events, function (event) {
      if (config.eventPreventDefault) {
        event.preventDefault();
      }
      self.grade(event);
    });
  }

  if (initial) {
    $element.find('.points').hide();
  }

  if (config.replay && config.replay.length > 0) {
    this.prepareReplay();
  }

  window.parent.postMessage({type: 'acos-resizeiframe-init'}, '*');
};

ACOSWebdev.prototype.extendReset = function (initial) {
};

ACOSWebdev.prototype.grade = function (eventOrMutations) {
  var self = this;
  if (typeof(this.config.points) == 'function') {
    this.extendGrade(eventOrMutations, function (r) {
      if (typeof(r) == 'number') {
        self.update(r);
      } else if (r !== undefined) {
        if (typeof(r.points) == 'number') {
          self.update(r.points, r.feedback);
        } else {
          self.log(r);
        }
      }
    });
  } else {
    this.update(this.config.maxPoints);
  }
};

ACOSWebdev.prototype.extendGrade = function (eventOrMutations, cb) {
  cb(this.config.points(this.$element, this.config, eventOrMutations));
};

ACOSWebdev.prototype.updatePointsDisplay = function (points, colorClass) {
  return this.$element.find('.points')
    .css('display', 'inline-block')
    .removeClass('red yellow green')
    .addClass(colorClass ? colorClass : '')
    .text(points + " / " + this.config.maxPoints + " p.");
};

ACOSWebdev.prototype.update = function (points, feedback) {
  var ab = this.config.abFlag;
  var mp = this.config.maxPoints;
  var p = Math.max(0, Math.min(Math.round(points), mp));
  if (!feedback) {
    feedback = p >= mp ? 'Problem solved succesfully.' : (p > 0 ? 'Problem solved partially.' : 'Problem not solved yet.');
  }
  var col = p >= mp ? 'green' : (p > 0 ? 'yellow' : 'red');
  this.$element.find('.toolbox .feedback').empty().append('<p>' + feedback + '</p>');
  this.updatePointsDisplay(p, col).ACOSWebdevExplosion(col, ab);
  window.parent.postMessage({type: 'acos-resizeiframe-init'}, '*');
  if (this.config.replay === undefined) {
    ACOS.sendEvent('grade', {
      'points': p,
      'max_points': mp,
      'session': this.session,
      'status': 'graded',
      'feedback': this.extendProtocolFeedback(feedback),
      'log': JSON.stringify(this.logStore),
      'u': this.config.u,
      'ab': ab
    });
  }
};

ACOSWebdev.prototype.store = function (status) {
  if (this.config.replay === undefined) {
    ACOS.sendEvent('log', {
      'session': this.session,
      'status': status,
      'log': JSON.stringify(this.logStore),
      'u': this.config.u,
      'ab': this.config.abFlag
    });
  }
};

ACOSWebdev.prototype.extendProtocolFeedback = function (feedback) {
  return this.$element.find('.exercise').html()
    + this.$element.find('.toolbox .feedback').html();
};

ACOSWebdev.prototype.uuid = function () {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

ACOSWebdev.prototype.prepareReplay = function () {
  const self = this;
  const replay = this.config.replay;
  this.replayIndex = 0;
  this.replayBegin = replay[0].time;
  this.replayLength = replay[replay.length - 1].time - this.replayBegin;
  this.replayLast = Date.now();

  $('#acos-replay .acos-replay-button').on('click', (e) => {
    self.replayTo(self.replayBegin);
  });
  this.$replayTimeline = $('#acos-replay .acos-replay-timeline').on('click', (e) => {
    self.replayTo(self.replayBegin + Math.floor(e.offsetX / self.$replayTimeline.width() * self.replayLength));
  });
  this.$replayTime = $('#acos-replay .acos-replay-time').text('0 s');
  $('#acos-replay .acos-replay-total').text(this.formatTime(this.replayLength));
  this.$replayBar = $('#acos-replay .acos-replay-progress').css('width', '0%');

  // Mark events on timeline
  const timeline = document.getElementById('acos-replay-canvas');
  const ctx = timeline.getContext('2d');
  for (let i = 0; i < replay.length; i++) {
    const x = Math.round((replay[i].time - this.replayBegin) / this.replayLength * timeline.width);
    ctx.fillStyle = this.replayEventColor(replay[i]);
    ctx.fillRect(x - 0.5, 0, 1, timeline.height);
  }

  this.replayTo(this.replayBegin);
}

ACOSWebdev.prototype.replayTo = function (toTime) {
  if (this.replayTimeout) {
    clearTimeout(this.replayTimeout);
  }
  let event = this.config.replay[this.replayIndex];
  if (toTime > event.time) {
    event = this.config.replay[this.replayIndex + 1];
    while (event && event.time <= toTime) {
      this.replayEvent(event);
      this.replayIndex += 1;
      event = this.config.replay[this.replayIndex + 1];
    }
  } else if (toTime < event.time) {
    event = this.config.replay[this.replayIndex - 1];
    while (event && event.time >= toTime) {
      this.replayEvent(event, true);
      this.replayIndex -= 1;
      event = this.config.replay[this.replayIndex - 1];
    }
  }
  const ms = toTime - this.replayBegin;
  this.$replayTime.text(this.formatTime(ms));
  this.$replayBar.css('width', `${Math.round(ms / this.replayLength * 100)}%`);
  event = this.config.replay[this.replayIndex + 1];
  if (event) {
    let nextTime = toTime + 100;
    /* Disable jumping
    let delay = event.time - toTime;
    if (delay > 8000) {
      this.replayMessage(`${this.formatTime(delay)} later...`);
      nextTime = event.time - 2000;
    } */
    this.replayTimeout = setTimeout(
      () => this.replayTo(nextTime),
      Math.max(0, 100 - (Date.now() - this.replayLast))
    );
    this.replayLast = Date.now();
  }
};

ACOSWebdev.prototype.replayEvent = function (event, backward) {
  this.$element.find('.acos-replay-message').remove();
  if (!this.extendReplayEvent(event, backward)) {
    switch (event.type) {
      case 'mouseClick':
        return this.replayMessage('click', event.x, event.y);
      case 'windowBlur':
        return this.replayMessage('window exited focus');
      case 'windowFocus':
        return this.replayMessage('window to focus');
      case 'grade':
        if (backward) {
          return this.update(0, '');
        } else {
          return this.grade();
        }
      default:
        return this.replayMessage(`unknown event: ${event.type}`);
    }
  }
};

ACOSWebdev.prototype.extendReplayEvent = function (event, backward) {
  return false;
};

ACOSWebdev.prototype.replayEventColor = function (event) {
  const c = this.extendReplayEventColor(event);
  if (c !== undefined) {
    return c;
  }
  if (event.type === 'grade') {
    return event.points >= event.maxPoints ? '#00ff7f' : '#ffff00';
  }
  if (event.type === 'mouseClick') {
    return '#888888';
  }
  return '#e0e0e0';
};

ACOSWebdev.prototype.extendReplayEventColor = function (event) {
  return undefined;
};

ACOSWebdev.prototype.replayMessage = function (message, x, y) {
  this.$element.append($('<div class="acos-replay-message"></div>').html(message).css({
    position: 'absolute',
    left: x !== undefined ? `${x}px` : '50%',
    top: y !== undefined ? `${y}px` : '15%',
    'z-index': 10,
  }));
};

ACOSWebdev.prototype.formatTime = function (t) {
  let s = Math.round(t / 1000);
  if (s < 60) {
    return `${s} s`;
  }
  return `${Math.floor(s / 60)}:${s % 60} m:s`;
};

/****
 * Animated explosion.
 * Adapted from http://www.gameplaypassion.com/blog/explosion-effect-html5-canvas/
 *
 * Random from normal distribution using Marsaglia Polar method.
 * Adapted from https://github.com/mock-end/random-normal
 *
 * If AB test flag is set then B population will see
 * on average larger explosions than A population.
 */
 $.fn.ACOSWebdevExplosion = function (color, abFlag) {

   var fullCircle = Math.PI * 2;

   function Particle(x, y, radius, color) {
     this.x = x;
     this.y = y;
     this.scale = 1.0;
     this.velocityX = 0;
     this.velocityY = 0;
     this.scaleSpeed = 0.5;

     this.update = function (ms) {
       this.scale -= this.scaleSpeed * ms / 1000.0;
       if (this.scale <= 0) {
         this.scale = 0;
       }
       this.x += this.velocityX * ms / 1000.0;
       this.y += this.velocityY * ms / 1000.0;
       return this;
     };

     this.draw = function (context2D) {
       context2D.save();
       context2D.translate(this.x, this.y);
       context2D.scale(this.scale, this.scale);
       context2D.beginPath();
       context2D.arc(0, 0, radius, 0, fullCircle, true);
       context2D.closePath();
       context2D.fillStyle = color;
       context2D.fill();
       context2D.restore();
     };
   }

   function Explosion($parent, color, range) {
     var diameter = 2 * range;
     var minSize = range / 10;
     var maxSize = range / 5;
     var minSpeed = 1.0 * range;
     var maxSpeed = 2.0 * range;
     var minScaleSpeed = 2.0;
     var maxScaleSpeed = 4.0;
     var frameDelay = 30;
     var frames = 20;

     this.randomFloat = function (min, max) {
       return min + Math.random() * (max - min);
     };

     this.createOneSet = function (x, y, count, color) {
       for (var angle = 0; angle < fullCircle; angle += Math.round(fullCircle / count)) {
         var particle = new Particle(x, y, this.randomFloat(minSize, maxSize), color);
         particle.scaleSpeed = this.randomFloat(minScaleSpeed, maxScaleSpeed);
         var speed = this.randomFloat(minSpeed, maxSpeed);
         particle.velocityX = speed * Math.cos(angle);
         particle.velocityY = speed * Math.sin(angle);
         this.particles.push(particle);
       }
     };

     this.start = function ($parent) {
       $parent.css('position', 'relative').find('canvas.explosion').remove();
       this.canvas = $('<canvas></canvas>').attr({
         'class': 'explosion',
         'width': diameter,
         'height': diameter
       }).css({
         'position': 'absolute',
         'z-index': '10',
         'left': '50%',
         'top': '50%',
         'margin': '-' + range + 'px 0 0 -' + range + 'px'
       });
       $parent.append(this.canvas);
       this.context = this.canvas.get(0).getContext('2d');
       this.particles = [];
       this.createOneSet(range, range, 6, color);
       this.createOneSet(range, range, 4, 'light' + color);
       this.update(frames);
     };

     this.update = function (n) {
       this.context.clearRect(0, 0, diameter, diameter);
       for (var i = 0; i < this.particles.length; i++) {
         this.particles[i].update(frameDelay).draw(this.context);
       }
       if (n > 0) {
         var explosion = this;
         setTimeout(function () {
           explosion.update(n - 1);
         }, frameDelay);
       } else {
         this.end();
       }
     };

     this.end = function () {
       this.canvas.remove();
     };

     this.start($parent);
   }

   function randomNormal(mean, dev) {
     var s;
     var u;
     var v;
     do {
       u = Math.random() * 2 - 1;
       v = Math.random() * 2 - 1;
       s = u * u + v * v;
     } while (s >= 1);
     return u * Math.sqrt(-2 * Math.log(s) / s) * (dev !== undefined ? dev : 1) + (mean || 0);
   }

   this.each(function (i) {
     new Explosion($(this), color, Math.round(randomNormal(abFlag ? 200 : 100, 20)));
   });

   return this;
 };
