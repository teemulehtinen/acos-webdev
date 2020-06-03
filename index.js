/* global module, require, __dirname, console */
/* jshint globalstrict: true */
'use strict';

var fs = require('fs');
let nj = require('nunjucks');
let baseDir = __dirname;

var Type = function () {};
Type.meta = {
    'name': 'webdev',
    'shortDescription': 'Content type for web development exercises.',
    'description': '',
    'author': 'Lassi Haaranen & Teemu Lehtinen',
    'license': 'MIT',
    'version': '0.1.0',
    'url': ''
};
Type.packageType = 'content-type';
Type.namespace = 'webdev';
Type.installedContentPackages = [];

Type.register = function (handlers, app, conf) {
    handlers.contentTypes.webdev = Type;
    Type.logDirectory = conf.logDirectory + '/webdev/';
    try {
      fs.mkdir(Type.logDirectory, '0775', function (err) {});
    } catch(e) {
      console.log('Couldn\'t create direcotry ' + Type.logDirectory);
    }
};

Type.uniqueUserID = function (req) {
  /* Try the known protocol values or fallback to zero. */
  return parseInt((req.body.user_id || req.query.uid || '0').match(/\d+/g).join(''))
}

Type.initialize = function (req, params, handlers, cb) {

  // Select AB-test population
  let uid = Type.uniqueUserID(req);
  let abFlag = uid % 2 == 1;

  // Initialize the content package
  handlers.contentPackages[req.params.contentPackage].initialize(req, params, handlers, function (config) {
    if (config) {
      let addToTop = config.addToTop;
      let addToHead = config.addToHead;
      let addToBody = config.addToBody;
      config.addToTop = undefined;
      config.addToHead = undefined;
      config.addToBody = undefined;
      config.u = uid;
      config.abFlag = abFlag;

      let templateParam = {
        id: 'acos-' + req.params.contentPackage + '-' + params.name,
        class: 'acos-' + req.params.contentType + '-exercise acos-' + req.params.contentPackage,
        addToTop: addToTop,
        addToHead: addToHead,
        addToBody: addToBody,
        verticalLayout: config.verticalLayout || false,
        triggerButton: config.triggerButton || false,
        resetButton: config.resetButton || false,
        config: JSON.stringify(config),
        script: typeof(config.script) == 'function' ? config.script.toString() : undefined,
        points: typeof(config.points) == 'function' ? config.points.toString() : undefined
      };
      let templateDir = baseDir + '/templates/';
      nj.configure(templateDir, { autoescape: false });
      params.headContent += nj.render('head.html', templateParam);
      params.bodyContent += nj.render('body.html', templateParam);
    } else {
      params.bodyContent += '<p>No content found.</p>';
    }
    cb();
  });
};

Type.handleEvent = function (event, payload, req, res, protocolPayload, responseObj, cb) {
  if (event == 'log' || event == 'grade') {
    var dir = Type.logDirectory + req.params.contentPackage;
    fs.mkdir(dir, '0775', function (err) {
      var data = new Date().toISOString()
        + '\t' + JSON.stringify(payload)
        + '\t' + JSON.stringify(protocolPayload || {}) + '\n';
      var logName = req.params.name.replace(/\.|\/|\\|~/g, "-") + '.log';
      fs.writeFile(dir + '/' + logName, data, {flag: 'a'}, function (err) {
        cb(event, payload, req, res, protocolPayload, responseObj);
      });
    });
  } else {
    cb(event, payload, req, res, protocolPayload, responseObj);
  }
};

module.exports = Type;
