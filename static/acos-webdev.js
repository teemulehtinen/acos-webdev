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

  if (config.mutationObserver) {
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

  if (config.triggerButton) {
    $element.find('.toolbox .trigger-button').on('click', function (event) {
      self.grade(event);
    });
  }
  if (config.resetButton) {
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
  if (config.selector && config.events) {
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
    .show()
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
};

ACOSWebdev.prototype.store = function (status) {
  ACOS.sendEvent('log', {
    'session': this.session,
    'status': status,
    'log': JSON.stringify(this.logStore),
    'u': this.config.u,
    'ab': this.config.abFlag
  });
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
