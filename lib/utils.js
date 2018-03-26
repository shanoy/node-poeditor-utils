'use strict';

var Client = require('poeditor-client');
var Promise = require('bluebird');
var Immutable = require('immutable');
var fs = Promise.promisifyAll(require('fs'));
var stringify = require('json-stable-stringify');

var Translation = require('./Translation');

exports.getProject = function (apiToken, projectName) {
    var client = new Client(apiToken);
    return Promise.resolve(client.projects.list())
        .then(function (projects) {
            return Immutable.List(projects)
                .find(function (project) {
                    return project.name == projectName;
                });
        });
};

exports.getTranslations = function (project) {
    return Promise.resolve(project.languages.list())
        .map(function (language) {
            return Promise.resolve(language.terms.list())
                .map(function (term) {
                    return new Translation(term.term, language.code, term.translation);
                });
        })
        .then(function (items) {
            return Immutable.fromJS(items).flatten(1).toJS();
        });
};

exports.writeTranslations = function (translations, getFile, dontSaveEmptyValues) {
    var translationsToWrite = translations;
    if (dontSaveEmptyValues) {
        var allTranslations = translations;
        translationsToWrite = [];

        for (var i = 0; i < allTranslations.length; i++) {
            if (allTranslations[i].value) {
                translationsToWrite.push(allTranslations[i]);
            }
        }
    }
    var writes = Immutable.List(translationsToWrite)
        .groupBy(getFile)
        .map(function (translations) {
            return Immutable.List(translations)
                .reduce(function (result, translation) {
                    return result.set(translation.term, translation.value);
                }, Immutable.Map());
        })
        .map(function (translations, file) {
            var data = stringify(translations, {
                space: '\t'
            });
            return fs.writeFileAsync(file, data)
                .then(function () {
                    return file;
                });
        })
        .toList()
        .toJS();
    return Promise.all(writes);
};

exports.pullTranslations = function (apiToken, projectName, getFile, dontSaveEmptyValues) {
    return exports.getProject(apiToken, projectName)
        .then(function (project) {
            return exports.getTranslations(project);
        })
        .then(function (translations) {
            return exports.writeTranslations(translations, getFile, dontSaveEmptyValues);
        });
};

