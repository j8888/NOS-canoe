'use strict'
/* global angular chrome */
angular.module('canoeApp.services').factory('openURLService', function ($rootScope, $ionicHistory, $document, $log, $state, platformInfo, lodash, profileService, incomingData, appConfigService) {
  var root = {}

  var handleOpenURL = function (args) {
    $log.info('Handling Open URL: ' + JSON.stringify(args))
    // Stop it from caching the first view as one to return when the app opens
    $ionicHistory.nextViewOptions({
      historyRoot: true,
      disableBack: false,
      disableAnimation: true
    })

    var url = args.url
    if (!url) {
      $log.error('No url provided')
      return
    }

    if (url) {
      if ('cordova' in window) {
        window.cordova.removeDocumentEventHandler('handleopenurl')
        window.cordova.addStickyDocumentEventHandler('handleopenurl')
      }
      document.removeEventListener('handleopenurl', handleOpenURL)
    }

    document.addEventListener('handleopenurl', handleOpenURL, false)

    incomingData.redir(url, null, function (err, code) {
      if (err) {
        $log.warn('Unknown URL! : ' + url)
      }
    })
  }

  var handleResume = function () {
    $log.debug('Handle Resume @ openURL...')
    document.addEventListener('handleopenurl', handleOpenURL, false)
  }

  root.init = function () {
    $log.debug('Initializing openURL')
    document.addEventListener('handleopenurl', handleOpenURL, false)
    document.addEventListener('resume', handleResume, false)

    if (platformInfo.isChromeApp) {
      $log.debug('Registering Chrome message listener')
      chrome.runtime.onMessage.addListener(
        function (request, sender, sendResponse) {
          if (request.url) {
            handleOpenURL(request.url)
          }
        })
    } else if (platformInfo.isNW) {
      var gui = require('nw.gui')

      // This event is sent to an existent instance of Canoe (only for standalone apps)
      gui.App.on('open', function (pathData) {
        // All URL protocols plus bare accounts
        if (pathData.match(/^(usd:|canoe:|usd_)/) !== null) {
          $log.debug('Nano or Canoe URL found')
          handleOpenURL({
            url: pathData
          })
        }
      })

      // Used at the startup of Canoe
      var argv = gui.App.argv
      if (argv && argv[0]) {
        handleOpenURL({
          url: argv[0]
        })
      }
    } else if (platformInfo.isDevel) {
      var base = window.location.origin + '/'
      var url = base + '#/uri/%s'

      if (navigator.registerProtocolHandler) {
        $log.debug('Registering Browser handlers base:' + base)
        // These two not allowed, see: https://developer.mozilla.org/en-US/docs/Web/API/Navigator/registerProtocolHandler
        // navigator.registerProtocolHandler('nano', url, 'Canoe Nano Handler')
        // navigator.registerProtocolHandler('xrb', url, 'Canoe XRB Handler')
        navigator.registerProtocolHandler('web+usd', url, 'Canoe web usd Handler')
        navigator.registerProtocolHandler('web+canoe', url, 'Canoe Wallet Handler')
      }
    }
  }

  root.registerHandler = function (x) {
    $log.debug('Registering URL Handler: ' + x.name)
    root.registeredUriHandlers.push(x)
  }

  root.handleURL = function (args) {
    profileService.whenAvailable(function () {
      // Wait ux to settle
      setTimeout(function () {
        handleOpenURL(args)
      }, 1000)
    })
  }

  return root
})
