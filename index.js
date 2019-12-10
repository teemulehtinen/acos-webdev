/* global module, require */
/* jshint globalstrict: true */
'use strict';

var fs = require('fs');
var WEBDEV = function () {};

WEBDEV.handleEvent = function (event, payload, req, res, protocolPayload, responseObj, cb) {
  /* req.params e.g.:
    { protocol: 'lti',
      contentType: 'webdev',
      contentPackage: 'webdev-iwdap',
      name: 'hidden_button' }
  */
  var dir = WEBDEV.logDirectory + req.params.contentPackage;
  if (event == 'log') {
    fs.mkdir(dir, '0775¨', function (err) {
      var data = new Date().toISOString()
        + '\t' + JSON.stringify(payload.log)
        + '\t' + JSON.stringify(protocolPayload || {}) + '\n';
      var logName = payload.problemName.replace(/\.|\/|\\|~/g, "-") + '.log';
      fs.writeFile(dir + '/' + logName, data, {flag: 'a'}, function (err) {
        cb(event, payload, req, res, protocolPayload, responseObj);
      });
    });
  } else {
    cb(event, payload, req, res, protocolPayload, responseObj);
  }
};

WEBDEV.addToHead = function (params) {
  return '<link href="/static/webdev/acos-webdev.css" rel="stylesheet">\n'
    + '<script src="/static/webdev/acos-webdev.js" type="text/javascript"></script>\n';
};

WEBDEV.addToBody = function (params) {
    return '';
};

WEBDEV.uniqueUserID = function (req) {
  /* Try the known protocol values or fallback to zero. */
  return parseInt((req.body.user_id || req.query.uid || '0').match(/\d+/g).join(''))
}

WEBDEV.initialize = function (req, params, handlers, cb) {

  // Select AB-test population
  params.abFlag = WEBDEV.uniqueUserID(req) % 2 == 1;

  // Initialize the content type
  params.headContent += WEBDEV.addToHead(params);
  params.bodyContent += WEBDEV.addToBody(params);

  // Initialize the content package
  handlers.contentPackages[req.params.contentPackage].initialize(req, params, handlers, function () {
    cb();
  });
};

WEBDEV.register = function (handlers, app, conf) {
    handlers.contentTypes.webdev = WEBDEV;
    WEBDEV.logDirectory = conf.logDirectory + '/webdev/';
    try {
      fs.mkdir(WEBDEV.logDirectory, '0775', function (err) {});
    } catch(e) {
      console.log('Couldn\'t create direcotry ' + WEBDEV.logDirectory);
    }
};

WEBDEV.namespace = 'webdev';
WEBDEV.installedContentPackages = [];
WEBDEV.packageType = 'content-type';
WEBDEV.meta = {
    'name': 'webdev',
    'shortDescription': 'Content type for web development exercises.',
    'description': '',
    'author': 'Lassi Haaranen & Teemu Lehtinen',
    'license': 'MIT',
    'version': '0.1.0',
    'url': ''
};

module.exports = WEBDEV;
