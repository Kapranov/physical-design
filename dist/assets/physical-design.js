/* jshint ignore:start */

/* jshint ignore:end */

define('physical-design/app', ['exports', 'ember', 'ember/resolver', 'ember/load-initializers', 'physical-design/config/environment'], function (exports, Ember, Resolver, loadInitializers, config) {

  'use strict';

  Ember['default'].MODEL_FACTORY_INJECTIONS = true;

  var App = Ember['default'].Application.extend({
    modulePrefix: config['default'].modulePrefix,
    podModulePrefix: config['default'].podModulePrefix,
    Resolver: Resolver['default']
  });

  loadInitializers['default'](App, config['default'].modulePrefix);

  exports['default'] = App;

});
define('physical-design/components/lf-outlet', ['exports', 'liquid-fire/ember-internals'], function (exports, ember_internals) {

	'use strict';

	exports['default'] = ember_internals.StaticOutlet;

});
define('physical-design/components/lf-overlay', ['exports', 'ember'], function (exports, Ember) {

  'use strict';

  var COUNTER = '__lf-modal-open-counter';

  exports['default'] = Ember['default'].Component.extend({
    tagName: 'span',
    classNames: ['lf-overlay'],

    didInsertElement: function didInsertElement() {
      var body = Ember['default'].$('body');
      var counter = body.data(COUNTER) || 0;
      body.addClass('lf-modal-open');
      body.data(COUNTER, counter + 1);
    },

    willDestroy: function willDestroy() {
      var body = Ember['default'].$('body');
      var counter = body.data(COUNTER) || 0;
      body.data(COUNTER, counter - 1);
      if (counter < 2) {
        body.removeClass('lf-modal-open');
      }
    }
  });

});
define('physical-design/components/liquid-child', ['exports', 'ember'], function (exports, Ember) {

  'use strict';

  exports['default'] = Ember['default'].Component.extend({
    classNames: ['liquid-child'],
    attributeBindings: ['style'],
    style: Ember['default'].computed('visible', function () {
      return new Ember['default'].Handlebars.SafeString(this.get('visible') ? '' : 'visibility:hidden');
    }),
    tellContainerWeRendered: Ember['default'].on('didInsertElement', function () {
      this.sendAction('didRender', this);
    })
  });

});
define('physical-design/components/liquid-container', ['exports', 'ember', 'liquid-fire/growable', 'physical-design/components/liquid-measured'], function (exports, Ember, Growable, liquid_measured) {

  'use strict';

  exports['default'] = Ember['default'].Component.extend(Growable['default'], {
    classNames: ["liquid-container"],
    classNameBindings: ["liquidAnimating"],

    lockSize: function lockSize(elt, want) {
      elt.outerWidth(want.width);
      elt.outerHeight(want.height);
    },

    unlockSize: function unlockSize() {
      var _this = this;

      var doUnlock = function doUnlock() {
        if (!_this.isDestroyed) {
          _this.set("liquidAnimating", false);
        }
        var elt = _this.$();
        if (elt) {
          elt.css({ width: "", height: "" });
        }
      };
      if (this._scaling) {
        this._scaling.then(doUnlock);
      } else {
        doUnlock();
      }
    },

    startMonitoringSize: Ember['default'].on("didInsertElement", function () {
      this._wasInserted = true;
    }),

    actions: {

      willTransition: function willTransition(versions) {
        if (!this._wasInserted) {
          return;
        }

        // Remember our own size before anything changes
        var elt = this.$();
        this._cachedSize = liquid_measured.measure(elt);

        // And make any children absolutely positioned with fixed sizes.
        for (var i = 0; i < versions.length; i++) {
          goAbsolute(versions[i]);
        }

        // Apply '.liquid-animating' to liquid-container allowing
        // any customizable CSS control while an animating is occuring
        this.set("liquidAnimating", true);
      },

      afterChildInsertion: function afterChildInsertion(versions) {
        var elt = this.$();

        // Measure  children
        var sizes = [];
        for (var i = 0; i < versions.length; i++) {
          if (versions[i].view) {
            sizes[i] = liquid_measured.measure(versions[i].view.$());
          }
        }

        // Measure ourself again to see how big the new children make
        // us.
        var want = liquid_measured.measure(elt);
        var have = this._cachedSize || want;

        // Make ourself absolute
        this.lockSize(elt, have);

        // Make the children absolute and fixed size.
        for (i = 0; i < versions.length; i++) {
          goAbsolute(versions[i], sizes[i]);
        }

        // Kick off our growth animation
        this._scaling = this.animateGrowth(elt, have, want);
      },

      afterTransition: function afterTransition(versions) {
        for (var i = 0; i < versions.length; i++) {
          goStatic(versions[i]);
        }
        this.unlockSize();
      }
    }
  });

  function goAbsolute(version, size) {
    if (!version.view) {
      return;
    }
    var elt = version.view.$();
    var pos = elt.position();
    if (!size) {
      size = liquid_measured.measure(elt);
    }
    elt.outerWidth(size.width);
    elt.outerHeight(size.height);
    elt.css({
      position: "absolute",
      top: pos.top,
      left: pos.left
    });
  }

  function goStatic(version) {
    if (version.view) {
      version.view.$().css({ width: "", height: "", position: "" });
    }
  }

});
define('physical-design/components/liquid-if', ['exports', 'ember', 'liquid-fire/ember-internals'], function (exports, Ember, ember_internals) {

  'use strict';

  exports['default'] = Ember['default'].Component.extend({
    _yieldInverse: ember_internals.inverseYieldMethod,
    hasInverse: Ember['default'].computed('inverseTemplate', function () {
      return !!this.get('inverseTemplate');
    })
  });

});
define('physical-design/components/liquid-measured', ['exports', 'liquid-fire/mutation-observer', 'ember'], function (exports, MutationObserver, Ember) {

  'use strict';

  exports.measure = measure;

  exports['default'] = Ember['default'].Component.extend({

    didInsertElement: function didInsertElement() {
      var self = this;

      // This prevents margin collapse
      this.$().css({
        overflow: "auto"
      });

      this.didMutate();

      this.observer = new MutationObserver['default'](function (mutations) {
        self.didMutate(mutations);
      });
      this.observer.observe(this.get("element"), {
        attributes: true,
        subtree: true,
        childList: true,
        characterData: true
      });
      this.$().bind("webkitTransitionEnd", function () {
        self.didMutate();
      });
      // Chrome Memory Leak: https://bugs.webkit.org/show_bug.cgi?id=93661
      window.addEventListener("unload", function () {
        self.willDestroyElement();
      });
    },

    willDestroyElement: function willDestroyElement() {
      if (this.observer) {
        this.observer.disconnect();
      }
    },

    transitionMap: Ember['default'].inject.service("liquid-fire-transitions"),

    didMutate: function didMutate() {
      // by incrementing the running transitions counter here we prevent
      // tests from falling through the gap between the time they
      // triggered mutation the time we may actually animate in
      // response.
      var tmap = this.get("transitionMap");
      tmap.incrementRunningTransitions();
      Ember['default'].run.next(this, function () {
        this._didMutate();
        tmap.decrementRunningTransitions();
      });
    },

    _didMutate: function _didMutate() {
      var elt = this.$();
      if (!elt || !elt[0]) {
        return;
      }
      this.set("measurements", measure(elt));
    }

  });
  function measure($elt) {
    var width, height;

    // if jQuery sees a zero dimension, it will temporarily modify the
    // element's css to try to make its size measurable. But that's bad
    // for us here, because we'll get an infinite recursion of mutation
    // events. So we trap the zero case without hitting jQuery.

    if ($elt[0].offsetWidth === 0) {
      width = 0;
    } else {
      width = $elt.outerWidth();
    }
    if ($elt[0].offsetHeight === 0) {
      height = 0;
    } else {
      height = $elt.outerHeight();
    }

    return {
      width: width,
      height: height
    };
  }

});
define('physical-design/components/liquid-modal', ['exports', 'ember'], function (exports, Ember) {

  'use strict';

  exports['default'] = Ember['default'].Component.extend({
    classNames: ['liquid-modal'],
    currentContext: Ember['default'].computed.oneWay('owner.modalContexts.lastObject'),

    owner: Ember['default'].inject.service('liquid-fire-modals'),

    innerView: Ember['default'].computed('currentContext', function () {
      var self = this,
          current = this.get('currentContext'),
          name = current.get('name'),
          container = this.get('container'),
          component = container.lookup('component-lookup:main').lookupFactory(name);
      Ember['default'].assert('Tried to render a modal using component \'' + name + '\', but couldn\'t find it.', !!component);

      var args = Ember['default'].copy(current.get('params'));

      args.registerMyself = Ember['default'].on('init', function () {
        self.set('innerViewInstance', this);
      });

      // set source so we can bind other params to it
      args._source = Ember['default'].computed(function () {
        return current.get('source');
      });

      var otherParams = current.get('options.otherParams');
      var from, to;
      for (from in otherParams) {
        to = otherParams[from];
        args[to] = Ember['default'].computed.alias('_source.' + from);
      }

      var actions = current.get('options.actions') || {};

      // Override sendAction in the modal component so we can intercept and
      // dynamically dispatch to the controller as expected
      args.sendAction = function (name) {
        var actionName = actions[name];
        if (!actionName) {
          this._super.apply(this, Array.prototype.slice.call(arguments));
          return;
        }

        var controller = current.get('source');
        var args = Array.prototype.slice.call(arguments, 1);
        args.unshift(actionName);
        controller.send.apply(controller, args);
      };

      return component.extend(args);
    }),

    actions: {
      outsideClick: function outsideClick() {
        if (this.get('currentContext.options.dismissWithOutsideClick')) {
          this.send('dismiss');
        } else {
          proxyToInnerInstance(this, 'outsideClick');
        }
      },
      escape: function escape() {
        if (this.get('currentContext.options.dismissWithEscape')) {
          this.send('dismiss');
        } else {
          proxyToInnerInstance(this, 'escape');
        }
      },
      dismiss: function dismiss() {
        var source = this.get('currentContext.source'),
            proto = source.constructor.proto(),
            params = this.get('currentContext.options.withParams'),
            clearThem = {};

        for (var key in params) {
          if (proto[key] instanceof Ember['default'].ComputedProperty) {
            clearThem[key] = undefined;
          } else {
            clearThem[key] = proto[key];
          }
        }
        source.setProperties(clearThem);
      }
    }
  });

  function proxyToInnerInstance(self, message) {
    var vi = self.get('innerViewInstance');
    if (vi) {
      vi.send(message);
    }
  }

});
define('physical-design/components/liquid-outlet', ['exports', 'ember', 'liquid-fire/ember-internals'], function (exports, Ember, ember_internals) {

	'use strict';

	exports['default'] = Ember['default'].Component.extend(ember_internals.OutletBehavior);

});
define('physical-design/components/liquid-spacer', ['exports', 'physical-design/components/liquid-measured', 'liquid-fire/growable', 'ember'], function (exports, liquid_measured, Growable, Ember) {

  'use strict';

  exports['default'] = Ember['default'].Component.extend(Growable['default'], {
    enabled: true,

    didInsertElement: function didInsertElement() {
      var child = this.$("> div");
      var measurements = this.myMeasurements(liquid_measured.measure(child));
      this.$().css({
        overflow: "hidden",
        outerWidth: measurements.width,
        outerHeight: measurements.height
      });
    },

    sizeChange: Ember['default'].observer("measurements", function () {
      if (!this.get("enabled")) {
        return;
      }
      var elt = this.$();
      if (!elt || !elt[0]) {
        return;
      }
      var want = this.myMeasurements(this.get("measurements"));
      var have = liquid_measured.measure(this.$());
      this.animateGrowth(elt, have, want);
    }),

    // given our child's outerWidth & outerHeight, figure out what our
    // outerWidth & outerHeight should be.
    myMeasurements: function myMeasurements(childMeasurements) {
      var elt = this.$();
      return {
        width: childMeasurements.width + sumCSS(elt, padding("width")) + sumCSS(elt, border("width")),
        height: childMeasurements.height + sumCSS(elt, padding("height")) + sumCSS(elt, border("height"))
      };
      //if (this.$().css('box-sizing') === 'border-box') {
    }

  });

  function sides(dimension) {
    return dimension === "width" ? ["Left", "Right"] : ["Top", "Bottom"];
  }

  function padding(dimension) {
    var s = sides(dimension);
    return ["padding" + s[0], "padding" + s[1]];
  }

  function border(dimension) {
    var s = sides(dimension);
    return ["border" + s[0] + "Width", "border" + s[1] + "Width"];
  }

  function sumCSS(elt, fields) {
    var accum = 0;
    for (var i = 0; i < fields.length; i++) {
      var num = parseFloat(elt.css(fields[i]), 10);
      if (!isNaN(num)) {
        accum += num;
      }
    }
    return accum;
  }

});
define('physical-design/components/liquid-versions', ['exports', 'ember', 'liquid-fire/ember-internals'], function (exports, Ember, ember_internals) {

  'use strict';

  var get = Ember['default'].get;
  var set = Ember['default'].set;

  exports['default'] = Ember['default'].Component.extend({
    tagName: "",
    name: "liquid-versions",

    transitionMap: Ember['default'].inject.service("liquid-fire-transitions"),

    appendVersion: Ember['default'].on("init", Ember['default'].observer("value", function () {
      var versions = get(this, "versions");
      var firstTime = false;
      var newValue = get(this, "value");
      var oldValue;

      if (!versions) {
        firstTime = true;
        versions = Ember['default'].A();
      } else {
        oldValue = versions[0];
      }

      // TODO: may need to extend the comparison to do the same kind of
      // key-based diffing that htmlbars is doing.
      if (!firstTime && (!oldValue && !newValue || oldValue === newValue)) {
        return;
      }

      this.notifyContainer("willTransition", versions);
      var newVersion = {
        value: newValue,
        shouldRender: newValue || get(this, "renderWhenFalse")
      };
      versions.unshiftObject(newVersion);

      this.firstTime = firstTime;
      if (firstTime) {
        set(this, "versions", versions);
      }

      if (!newVersion.shouldRender && !firstTime) {
        this._transition();
      }
    })),

    _transition: function _transition() {
      var _this = this;

      var versions = get(this, "versions");
      var transition;
      var firstTime = this.firstTime;
      this.firstTime = false;

      this.notifyContainer("afterChildInsertion", versions);

      transition = get(this, "transitionMap").transitionFor({
        versions: versions,
        parentElement: Ember['default'].$(ember_internals.containingElement(this)),
        use: get(this, "use"),
        // Using strings instead of booleans here is an
        // optimization. The constraint system can match them more
        // efficiently, since it treats boolean constraints as generic
        // "match anything truthy/falsy" predicates, whereas string
        // checks are a direct object property lookup.
        firstTime: firstTime ? "yes" : "no",
        helperName: get(this, "name")
      });

      if (this._runningTransition) {
        this._runningTransition.interrupt();
      }
      this._runningTransition = transition;

      transition.run().then(function (wasInterrupted) {
        // if we were interrupted, we don't handle the cleanup because
        // another transition has already taken over.
        if (!wasInterrupted) {
          _this.finalizeVersions(versions);
          _this.notifyContainer("afterTransition", versions);
        }
      }, function (err) {
        _this.finalizeVersions(versions);
        _this.notifyContainer("afterTransition", versions);
        throw err;
      });
    },

    finalizeVersions: function finalizeVersions(versions) {
      versions.replace(1, versions.length - 1);
    },

    notifyContainer: function notifyContainer(method, versions) {
      var target = get(this, "notify");
      if (target) {
        target.send(method, versions);
      }
    },

    actions: {
      childDidRender: function childDidRender(child) {
        var version = get(child, "version");
        set(version, "view", child);
        this._transition();
      }
    }

  });

});
define('physical-design/components/liquid-with', ['exports', 'ember'], function (exports, Ember) {

  'use strict';

  exports['default'] = Ember['default'].Component.extend({
    name: "liquid-with"
  });

});
define('physical-design/components/lm-container', ['exports', 'ember', 'liquid-fire/tabbable'], function (exports, Ember) {

  'use strict';

  /*
     Parts of this file were adapted from ic-modal

     https://github.com/instructure/ic-modal
     Released under The MIT License (MIT)
     Copyright (c) 2014 Instructure, Inc.
  */

  var lastOpenedModal = null;
  Ember['default'].$(document).on("focusin", handleTabIntoBrowser);

  function handleTabIntoBrowser() {
    if (lastOpenedModal) {
      lastOpenedModal.focus();
    }
  }

  exports['default'] = Ember['default'].Component.extend({
    classNames: ["lm-container"],
    attributeBindings: ["tabindex"],
    tabindex: 0,

    keyUp: function keyUp(event) {
      // Escape key
      if (event.keyCode === 27) {
        this.sendAction();
      }
    },

    keyDown: function keyDown(event) {
      // Tab key
      if (event.keyCode === 9) {
        this.constrainTabNavigation(event);
      }
    },

    didInsertElement: function didInsertElement() {
      this.focus();
      lastOpenedModal = this;
    },

    willDestroy: function willDestroy() {
      lastOpenedModal = null;
    },

    focus: function focus() {
      if (this.get("element").contains(document.activeElement)) {
        // just let it be if we already contain the activeElement
        return;
      }
      var target = this.$("[autofocus]");
      if (!target.length) {
        target = this.$(":tabbable");
      }

      if (!target.length) {
        target = this.$();
      }

      target[0].focus();
    },

    constrainTabNavigation: function constrainTabNavigation(event) {
      var tabbable = this.$(":tabbable");
      var finalTabbable = tabbable[event.shiftKey ? "first" : "last"]()[0];
      var leavingFinalTabbable = finalTabbable === document.activeElement ||
      // handle immediate shift+tab after opening with mouse
      this.get("element") === document.activeElement;
      if (!leavingFinalTabbable) {
        return;
      }
      event.preventDefault();
      tabbable[event.shiftKey ? "last" : "first"]()[0].focus();
    },

    click: function click(event) {
      if (event.target === this.get("element")) {
        this.sendAction("clickAway");
      }
    }
  });

});
define('physical-design/components/speaker-details', ['exports', 'ember'], function (exports, Ember) {

  'use strict';

  exports['default'] = Ember['default'].Component.extend({
    classNames: ['speakers-list-inner'],

    actions: {
      edit: function edit() {
        this.set('editorName', this.get('model.name'));
        this.set('editorBio', this.get('model.bio'));
        this.set('editing', true);
      },
      save: function save() {
        this.set('model.name', this.get('editorName'));
        this.set('model.bio', this.get('editorBio'));
        this.set('editing', false);
      },
      cancel: function cancel() {
        this.set('editing', false);
      }
    }
  });

});
define('physical-design/controllers/emberconf/speakers', ['exports', 'ember'], function (exports, Ember) {

  'use strict';

  exports['default'] = Ember['default'].Controller.extend({
    actions: {
      shuffle: function shuffle() {
        this.get('model').forEach(function (person) {
          person._randomPosition = Math.random();
        });
        this.set('model', this.get('model').sortBy('_randomPosition'));
      }
    }
  });

});
define('physical-design/controllers/emberconf/sponsors', ['exports', 'ember'], function (exports, Ember) {

  'use strict';

  exports['default'] = Ember['default'].Controller.extend({
    actions: {
      'delete': function _delete(sponsor) {
        this.set('model', this.get('model').filter(function (s) {
          return s.id !== sponsor.id;
        }));
      }
    }
  });

});
define('physical-design/helpers/lf-yield-inverse', ['exports', 'liquid-fire/ember-internals'], function (exports, ember_internals) {

  'use strict';

  exports['default'] = {
    isHTMLBars: true,
    helperFunction: ember_internals.inverseYieldHelper
  };

});
define('physical-design/helpers/liquid-bind', ['exports', 'liquid-fire/ember-internals'], function (exports, ember_internals) {

	'use strict';

	exports['default'] = ember_internals.makeHelperShim("liquid-bind");

});
define('physical-design/helpers/liquid-if', ['exports', 'liquid-fire/ember-internals'], function (exports, ember_internals) {

  'use strict';

  exports['default'] = ember_internals.makeHelperShim('liquid-if', function (params, hash, options) {
    hash.helperName = 'liquid-if';
    hash.inverseTemplate = options.inverse;
  });

});
define('physical-design/helpers/liquid-outlet', ['exports', 'liquid-fire/ember-internals'], function (exports, ember_internals) {

  'use strict';

  exports['default'] = ember_internals.makeHelperShim("liquid-outlet", function (params, hash) {
    hash._outletName = params[0] || "main";
  });

});
define('physical-design/helpers/liquid-unless', ['exports', 'liquid-fire/ember-internals'], function (exports, ember_internals) {

  'use strict';

  exports['default'] = ember_internals.makeHelperShim('liquid-if', function (params, hash, options) {
    hash.helperName = 'liquid-unless';
    hash.inverseTemplate = options.template;
    options.template = options.inverse;
  });

});
define('physical-design/helpers/liquid-with', ['exports', 'liquid-fire/ember-internals'], function (exports, ember_internals) {

	'use strict';

	exports['default'] = ember_internals.makeHelperShim("liquid-with");

});
define('physical-design/helpers/with-br', ['exports', 'ember'], function (exports, Ember) {

  'use strict';

  exports['default'] = Ember['default'].Handlebars.makeBoundHelper(function (value) {
    return value ? Ember['default'].Handlebars.Utils.escapeExpression(value).replace(/\n/g, '<br>').htmlSafe() : '';
  });

});
define('physical-design/initializers/app-version', ['exports', 'physical-design/config/environment', 'ember'], function (exports, config, Ember) {

  'use strict';

  var classify = Ember['default'].String.classify;
  var registered = false;

  exports['default'] = {
    name: 'App Version',
    initialize: function initialize(container, application) {
      if (!registered) {
        var appName = classify(application.toString());
        Ember['default'].libraries.register(appName, config['default'].APP.version);
        registered = true;
      }
    }
  };

});
define('physical-design/initializers/export-application-global', ['exports', 'ember', 'physical-design/config/environment'], function (exports, Ember, config) {

  'use strict';

  exports.initialize = initialize;

  function initialize(container, application) {
    var classifiedName = Ember['default'].String.classify(config['default'].modulePrefix);

    if (config['default'].exportApplicationGlobal && !window[classifiedName]) {
      window[classifiedName] = application;
    }
  }

  ;

  exports['default'] = {
    name: 'export-application-global',

    initialize: initialize
  };

});
define('physical-design/initializers/liquid-fire', ['exports', 'liquid-fire/router-dsl-ext'], function (exports) {

  'use strict';

  // This initializer exists only to make sure that the following import
  // happens before the app boots.
  exports['default'] = {
    name: "liquid-fire",
    initialize: function initialize() {}
  };

});
define('physical-design/router', ['exports', 'ember', 'physical-design/config/environment'], function (exports, Ember, config) {

  'use strict';

  var Router = Ember['default'].Router.extend({
    location: config['default'].locationType
  });

  Router.map(function () {
    this.route('emberconf', function () {
      this.route('speakers');
      this.route('speaker', { path: '/speakers/:speaker_id' });

      this.route('sponsors', function () {
        this.route('sponsor', { path: '/:sponsor_id' });
      });
    });
  });

  exports['default'] = Router;

});
define('physical-design/routes/emberconf/speaker', ['exports', 'ember', 'physical-design/routes/emberconf/speakers'], function (exports, Ember, speakers) {

  'use strict';

  exports['default'] = Ember['default'].Route.extend({
    model: function model(params) {
      return speakers.speakerList.find(function (model) {
        return model.id === params.speaker_id;
      });
    }
  });

});
define('physical-design/routes/emberconf/speakers', ['exports', 'ember'], function (exports, Ember) {

  'use strict';

  exports['default'] = Ember['default'].Route.extend({
    model: function model() {
      return Ember['default'].A(speakerList.slice());
    }
  });

  var speakerList = [{
    "id": "ykatz",
    "imageURL": "images/speakers/ykatz.jpeg",
    "twitterURL": "http://twitter.com/@wycats",
    "twitterHandler": "@wycats",
    "name": "Yehuda Katz",
    "bio": "Yehuda is a member of the Ember.js, Ruby on Rails and jQuery Core Teams; his 9-to-5 home is at the startup he founded, Tilde Inc, where he works on Skylight, the smart profiler for Rails. Yehuda spends most of his time hacking on open source—his main projects, along with others, like Thor, Handlebars and Janus—and traveling the world doing open source evangelism work.",
    "session": "Keynote"
  }, {
    "id": "tdale",
    "imageURL": "images/speakers/tdale.jpg",
    "twitterURL": "http://twitter.com/@tomdale",
    "twitterHandler": "@tomdale",
    "name": "Tom Dale",
    "bio": "Tom is one of the creators of Ember.js, and a Co-founder at Tilde. He spends his days working on the open source projects Tilde supports, doing Ember consulting, and building their first developer product, Skylight. He's a former Apple engineer who first gained expert front-end JavaScript skills working on MobileMe and iCloud. He's a super hipster, and still isn't sure if it's serious or ironic.",
    "session": "Keynote"
  }, {
    "id": "ltan",
    "imageURL": "images/speakers/ltan.jpg",
    "twitterURL": "http://twitter.com/@sugarpirate_",
    "twitterHandler": "@sugarpirate_",
    "name": "Lauren Tan",
    "bio": "Self-taught designer turned front end developer for @homelyau, co-founder @pricegeek. Co-founded @pricegeek after finishing a Finance degree.",
    "session": "Ambitious UX for Ambitious Apps"
  }, {
    "id": "tbillups",
    "imageURL": "images/speakers/tbillups.jpeg",
    "twitterURL": "http://twitter.com/@toranb",
    "twitterHandler": "@toranb",
    "name": "Toran Billups",
    "bio": "Toran Billups is a software professional with a passion for all things javascript. When he isn't debating the tradeoffs of one-way vs two-way databinding you can find him teaching 5th grade students python!",
    "session": "Test Driven Development By Example"
  }, {
    "id": "gchan",
    "imageURL": "images/speakers/gchan.jpeg",
    "twitterURL": "http://twitter.com/@chancancode",
    "twitterHandler": "@chancancode",
    "name": "Godfrey Chan",
    "bio": "Godfrey Chan is co-founder at Brewhouse Software in Vancouver, Canada. He helps run the #EmberYVR meetup and is a member of the Ruby on Rails core team. In his previous life, he was also an award-winning WordPress™ plugin author.",
    "session": "Hijacking Hacker News with Ember.js"
  }, {
    "id": "efaulkner",
    "imageURL": "images/speakers/efaulkner.jpg",
    "twitterURL": "http://twitter.com/@eaf4",
    "twitterHandler": "@eaf4",
    "name": "Edward Faulkner",
    "bio": "Edward Faulkner is founder and CTO at BraveLeaf, a software startup that serves the long-term care industry. BraveLeaf's product is an Ember app, and may be one of the oldest continuously-updated Ember apps in the world (started on Sproutcore 1.6rc2! Get off my lawn!). He is also a research associate of the MIT Media Lab, and was previously a senior engineer at Akamai Technologies where he built internet-scale security and reliability infrastructure.",
    "session": "Physical Design"
  }, {
    "id": "mbeale",
    "imageURL": "images/speakers/mbeale.png",
    "twitterURL": "http://twitter.com/@mixonic",
    "twitterHandler": "@mixonic",
    "name": "Matthew Beale",
    "bio": "Matthew has been developing with Ember.js for several years. He is the author of an early book on Ember, blogs at madhatted.com, and happily spends his spare time contributing code. Through a consulting partnership named 201 Created, he's worked with nearly two dozen companies to solve tough problems with Ember.",
    "session": "Aligning Ember with Web Standards"
  }, {
    "id": "bstoroz",
    "imageURL": "images/speakers/bstoroz.png",
    "twitterURL": "http://twitter.com/@brittanystoroz",
    "twitterHandler": "@brittanystoroz",
    "name": "Brittany Storoz",
    "bio": "I believe in life, liberty and the pursuit of happiness and have been known to pick up pencils with my toes. Plus I write JavaScript at Mozilla.",
    "session": "Building Custom Apps with Ember CLI"
  }, {
    "id": "jwhite",
    "imageURL": "images/speakers/jwhite.png",
    "twitterURL": "http://twitter.com/@jgwhite",
    "twitterHandler": "@jgwhite",
    "name": "Jamie White",
    "bio": "Developer at With Associates. Organiser of Ember London. Volunteer thanks to Code Club. Learning with London Computation Club. Did I say London enough already?",
    "session": "Growing the community, one Tomster at a time"
  }, {
    "id": "spenner",
    "imageURL": "images/speakers/spenner.jpg",
    "twitterURL": "http://twitter.com/@stefanpenner",
    "twitterHandler": "@stefanpenner",
    "name": "Stef Penner",
    "bio": "Longboarding canadian, oss addict, ember.js core team member, living in manhattan and working at @yapp.",
    "session": "Ember.js Performance"
  }, {
    "id": "sselikoff",
    "imageURL": "images/speakers/sselikoff.jpeg",
    "twitterURL": "http://twitter.com/@samselikoff",
    "twitterHandler": "@samselikoff",
    "name": "Sam Selikoff",
    "bio": "Sam Selikoff is a front-end engineer at TED. Formerly a graduate student of economics, he unexpectedly discovered his love of programming while doing data work for a consulting firm. He is passionate about JavaScript, data visualization and economics.",
    "session": "Bring Sanity to Frontend Infrastructure with Ember.js"
  }, {
    "id": "dgebhardt",
    "imageURL": "images/speakers/dgebhardt.jpeg",
    "twitterURL": "http://twitter.com/@dgeb",
    "twitterHandler": "@dgeb",
    "name": "Dan Gebhardt",
    "bio": "Dan is a co-founder of the SaaS consultancy Cerebris and has been working as part of the Tilde team since 2012. He's been developing web applications for 15 years, with a recent focus on Rails-driven APIs and Ember UIs. Dan is an avid contributor to open source, the lead developer of Orbit.js, and a regular speaker. He loves hiking near his home in NH with his wife, two boys, and their ridiculously happy dog.",
    "session": "Fault Tolerant UX"
  }, {
    "id": "lsilber",
    "imageURL": "images/speakers/lsilber.jpg",
    "twitterURL": "http://twitter.com/@wifelette",
    "twitterHandler": "@wifelette",
    "name": "Leah Silber",
    "bio": "Leah is an all-around open source advocate. During the day time, she's one of the founders at Tilde Inc, the open-source-centric company behind Skylight. In her spare time, in addition to running EmberConf, Leah works on GoGaRuCo, RailsConf, and a number of User Groups. She's a retired member of the jQuery Core Team, and a member of the Ember Core Team.\n\nShe previously worked as a consultant for clients in the tech sector, ran events for the jQuery Foundation and was employed managing the Community Marketing and Events department at Engine Yard. She is originally from Brooklyn, NY and now lives in Portland, OR with her husband.",
    "session": "EmberConf MiniTalks"
  }, {
    "id": "lmelia",
    "imageURL": "images/speakers/lmelia.jpg",
    "twitterURL": "http://twitter.com/@lukemelia",
    "twitterHandler": "@lukemelia",
    "name": "Luke Melia",
    "bio": "Luke Melia is the organizer of the world-famous Ember.js NYC meetup. Luke helped launch one of the first commercial apps in Ember, Yapp, and is co-founder of Yapp Labs, a consultancy specializing in Ember.",
    "session": "The Art of Ember App Deployment"
  }, {
    "id": "blangslet",
    "imageURL": "images/speakers/blangslet.jpeg",
    "twitterURL": "http://twitter.com/@blangslet",
    "twitterHandler": "@blangslet",
    "name": "Bryan Langslet",
    "bio": "Bryan is a Product Designer turned passionate Ember developer currently building design-centric apps at Envoy (@signwithenvoy).\n\nHobbies include: drinking the Web Component Kool-Aid and twisting his mind in strange and beautiful ways through international travel.",
    "session": "Interaction Design with Ember 2.0 and Polymer"
  }, {
    "id": "strevathan",
    "imageURL": "images/speakers/strevathan.jpeg",
    "twitterURL": "http://twitter.com/@strevat",
    "twitterHandler": "@strevat",
    "name": "Steve Trevathan",
    "bio": "Partner, Creative Director at DockYard. Organizer of UX East, UX Happy Hour and UX Boston.",
    "session": "Designing for Ember Apps"
  }, {
    "id": "skinney",
    "imageURL": "images/speakers/skinney.jpg",
    "twitterURL": "http://twitter.com/@stevekinney",
    "twitterHandler": "@stevekinney",
    "name": "Steve Kinney",
    "bio": "Steve is an instructor at the Turing School of Software and Design and a former New York City teacher.",
    "session": "Building Real-Time Applications with Ember"
  }, {
    "id": "chenn",
    "imageURL": "images/speakers/chenn.jpg",
    "twitterURL": "http://twitter.com/@cjwhn",
    "twitterHandler": "@cjwhn",
    "name": "Chris Henn",
    "bio": "Chris Henn creates next-generation data visualizations for H2Ometrics, the collaborative water analytics platform. When he’s not working in Ember, Chris studies mathematics a Reed College in Portland, Oregon.",
    "session": "Dynamic Graphic Composition in Ember"
  }, {
    "id": "ceppstein",
    "imageURL": "images/speakers/ceppstein.jpg",
    "twitterURL": "http://twitter.com/@chriseppstein",
    "twitterHandler": "@chriseppstein",
    "name": "Chris Eppstein",
    "bio": "Coming Soon!",
    "session": "Closing Keynote"
  }];

  exports.speakerList = speakerList;

});
define('physical-design/routes/emberconf/sponsors', ['exports', 'ember'], function (exports, Ember) {

  'use strict';

  exports['default'] = Ember['default'].Route.extend({
    model: function model() {
      return Ember['default'].A(sponsorList.slice());
    }
  });

  var sponsorList = [{
    "url": "http://www.skylight.io",
    "imageURL": "/images/sponsors/skylight.png",
    "description": "Skylight is a smart profiler that lets you quickly diagnose and resolve performance issues with your Rails apps where it matters: in production. It's built by the fine folks at <a href=\"http://www.tilde.io\">Tilde Inc</a>, who have spent the last few years building open source projects like Ember, Handlebars and Rails itself. Visit <a href=\"http://www.skylight.io\">skylight.io</a> to start your free trial.",
    "name": "Skylight"
  }, {
    "url": "http://dockyard.com",
    "imageURL": "/images/sponsors/dockyard.png",
    "description": "DockYard is a full-stack development and design consultancy. Specialize in building beautifully designed Ember.js applications backed by Ruby on Rails, we've worked with startups as well as some of the largest companies in the world. We take  ownership of your project or work along side existing teams.",
    "name": "DockYard"
  }, {
    "url": "http://www.ticketfly.com",
    "imageURL": "/images/sponsors/ticketfly.png",
    "description": "Ticketfly is a progressive ticketing company that makes it easy to discover events, buy tickets, and share events with your friends – all with world-class technology and customer support. We build applications used by millions musicians and fans, trusted by the best venues and festivals like <a href=\"http://burningman.org/\">Burning Man</a>.",
    "name": "Ticketfly"
  }, {
    "url": "https://www.firebase.com/",
    "imageURL": "/images/sponsors/firebase.png",
    "description": "Firebase is a realtime API for building collaborative, modern applications. Using Firebase, you can easily wire up a backend for your Ember app with just frontend code. <a href=\"https://www.firebase.com/docs/web/libraries/ember/quickstart.html\"> EmberFire</a> is Firebase's officially supported adapter for using Firebase with Ember Data.",
    "name": "Firebase"
  }, {
    "url": "http://www.bustle.com",
    "imageURL": "/images/sponsors/bustle.png",
    "description": "Showcasing Ember to a monthly audience of more than 25 million. We're a product and tech driven media company focused on building the best web, mobile, and CMS products in publishing.",
    "name": "Bustle"
  }, {
    "url": "http://frontside.io/",
    "imageURL": "/images/sponsors/frontside.png",
    "description": "The Frontside is a consultancy that delivers beautiful, desktop-like experiences on the web using Ember. We believe that building great software starts by helping grow great software developers.",
    "name": "The Frontside"
  }, {
    "url": "http://spiceworks.com",
    "imageURL": "/images/sponsors/spiceworks.png",
    "description": "Used by over 6 million IT pros and 3000 tech vendors, <a href=\"http://spiceworks.com\">Spiceworks</a> is the world’s first social business application for IT – and somethin’ that’s got the tech world all-a-buzz! IT pros use <a href=\"http://spiceworks.com\">Spiceworks</a> to do their jobs, talk-shop with each other and vendors and show off their IT projects. All in one place. All for free!",
    "name": "Spiceworks"
  }, {
    "url": "http://www.zendesk.com",
    "imageURL": "/images/sponsors/zendesk.png",
    "description": "Zendesk provides a customer service platform designed to bring organizations and their customers closer together. With more than 45,000 customer accounts, Zendesk is used by organizations in 140 countries to provide support in more than 40 languages. Learn more at <a href=\"http://www.zendesk.com\">www.zendesk.com</a>.",
    "name": "Zendesk"
  }, {
    "url": "https://addepar.com/",
    "imageURL": "/images/sponsors/addepar.png",
    "description": "Build something meaningful - Addepar unites an extraordinary team of engineers, product-thinkers and industry experts to shape the future of investment management. The team is reimagining how technology brings integrity, transparency, and impact to one of the world’s largest industries. <a href=\"https://addepar.com/careers/\"> Come build with us</a>.",
    "name": "Addepar"
  }, {
    "url": "http://www.zenefits.com/",
    "imageURL": "/images/sponsors/zenefits.png",
    "description": "Manage all your HR—payroll, benefits, compliance, and more—online, in one beautiful dashboard. Zenefits is the fastest growing SaaS company EVER! We are experiencing explosive growth and are currently helping 10,000+ companies manage their employees better. Come join <a href=\"https://www.zenefits.com/\" '=\"\"> Zenefits</a>, and help us build an awesome product that improves people’s lives.",
    "name": "Zenefits"
  }, {
    "url": "http://beatport.com",
    "imageURL": "/images/sponsors/beatport.png",
    "description": "<a href=\"http://beatport.com\">Beatport</a> is the home of electronic music. It serves the largest community of DJs, labels, and fans in the world by allowing them to connect and listen to music. The Beatport team consists of developers, designers, and architects who build products that cultivate a great electronic dance music experience year-round.",
    "name": "Beatport"
  }, {
    "url": "http://customer.io/emberconf/",
    "imageURL": "/images/sponsors/customerio.png",
    "description": "<a href=\"http://customer.io/emberconf/\" '=\"\"> Customer.io </a> is a user-engagement platform built in Ember. A lightweight integration syncs real time data from your app. Mere mortals can create rules to send emails, A/B test content, and then see the results of their new superpowers in stats and charts.",
    "name": "Customer.io"
  }, {
    "url": "http://www.mandrill.com",
    "imageURL": "/images/sponsors/mandrill.png",
    "description": "Mandrill is a reliable, scalable, and secure email infrastructure service trusted by more than 375,000 customers. Our easy setup will have you sending in minutes, and our detailed analytics offer all the insight you and your team need to measure email performance.",
    "name": "Mandrill"
  }, {
    "url": "http://www.freshbooks.com",
    "imageURL": "/images/sponsors/freshbooks.png",
    "description": "FreshBooks is the #1 cloud accounting software designed exclusively for service-based small business owners, and offers easy-to-use time tracking, invoicing, online payments, and expense management. ‎Focused on empowering entrepreneurs to successfully run their businesses without having to learn accounting, FreshBooks is using Ember to make this a reality.",
    "name": "Freshbooks"
  }, {
    "url": "http://www.opengov.com",
    "imageURL": "/images/sponsors/opengov.png",
    "description": "OpenGov is a civic-focused technology company transforming the way governments analyze and share financial data. More than 250 local governments across the country use the OpenGov Platform to collaborate and achieve greater transparency. With OpenGov, governments make smarter, data-driven decisions, respond more efficiently to citizens and foster a better-informed community.",
    "name": "OpenGov"
  }, {
    "url": "http://locusenergy.com/",
    "imageURL": "/images/sponsors/locus.png",
    "description": "Locus Energy builds tools for the data monitoring and analytics of solar power systems. With some of the biggest names in solar as customers, our work has a tangible impact on the environment and economy. We use Ember for our data visualization tools and have big plans for more.",
    "name": "Locus Energy"
  }, {
    "url": "https://engineering.groupon.com/",
    "imageURL": "/images/sponsors/groupon.png",
    "description": "Groupon is redefining how small businesses attract, retain, and interact with customers by providing merchants with a suite of products and services, including customizable marketing campaigns, credit card payment processing, and point-of-sale solutions that help businesses grow and operate more effectively.",
    "name": "Groupon"
  }, {
    "url": "http://www.linkedin.com",
    "imageURL": "/images/sponsors/linkedin.png",
    "description": "<a href=\"https://www.linkedin.com\"> LinkedIn</a> is the world's largest professional network with 300 million members in over 200 countries and territories around the globe. Our mission is to connect the world's professionals to make them more productive and successful. <a href=\"https://www.linkedin.com\"> Join LinkedIn today</a>.",
    "name": "LinkedIn"
  }, {
    "url": "http://yahoo.com",
    "imageURL": "/images/sponsors/yahoo.png",
    "description": "Yahoo! Inc. (Yahoo!) is a global technology company. Through the Company’s technology and insights, Yahoo! delivers digital content and experiences, across devices and globally.  Yahoo currently has over two dozen applications using ember, and counting.",
    "name": "Yahoo"
  }, {
    "url": "http://madewithenvy.com",
    "imageURL": "/images/sponsors/envy.png",
    "description": "Envy is a web consultancy that helps transform ideas into successful products. We believe that great ideas can solve problems and improve lives — we work to solve those problems and improve the world around us through design and technology.",
    "name": "Envy"
  }, {
    "url": "http://www.lootcrate.com",
    "imageURL": "/images/sponsors/lootcrate.png",
    "description": "Founded in 2012, Loot Crate ships monthly themed mystery boxes of the best geek, gaming, and pop culture gear over 300,000 subscribers. The team works hard to deliver a great experience, phenomenal support, awesome community, and epic exclusives from some of the most respected entertainment and consumer product companies in the world.",
    "name": "Loot Crate"
  }, {
    "url": "http://www.dollarshaveclub.com/",
    "imageURL": "/images/sponsors/dollarshaveclub.png",
    "description": "Dollar Shave Club was founded in 2012 with the hopes of eliminating men’s shaving woes, and has amassed over $75 million in funding and 1.2 million users. Our engineering team uses Ember to build a fast, scalable, responsive, world-class experience at <a href=\"https://www.dollarshaveclub.com\"> dollarshaveclub.com</a>.",
    "name": "Dollar Shave Club"
  }, {
    "url": "http://echobind.com/emberconf",
    "imageURL": "/images/sponsors/echobind.png",
    "description": "Echobind is a consultancy that uses Ember and Rails to build exceptional web applications. We help existing teams improve their products and bring new concepts to life across industries ranging from financial services to healthcare.",
    "name": "Echobind"
  }, {
    "url": "http://www.stickermule.com/unlock?ref_id=3368978601",
    "imageURL": "/images/sponsors/stickermule.png",
    "description": "Sticker Mule is the fastest and easiest way to buy custom stickers. We offer free online proofs, 5 day turnaround and free UPS Ground shipping. With print runs starting at $49, we aim to be the Internet's favorite sticker printer.",
    "name": "Stickermule"
  }, {
    "url": "http://www.201-created.com/",
    "imageURL": "/images/sponsors/201created.png",
    "description": "<a href=\"201-created.com\">201 Created</a> is a small consulting partnership with big app experience from NYC. We're adept at migrating traditional applications to Ember and at writing software from scratch. Our founders are startup engineers who know how to move fast, build in-house skills, and work with open source communities.",
    "name": "201 Created"
  }, {
    "url": "http://www.puppetlabs.com",
    "imageURL": "/images/sponsors/puppet.png",
    "description": "Puppet Labs is the leader in IT automation. We're using Ember to build the next generation of our market-leading configuration management console, Puppet Enterprise.",
    "name": "Puppet Labs"
  }, {
    "url": "http://www.kangacoders.com",
    "imageURL": "/images/sponsors/kanga.png",
    "description": "<a href=\"https://www.kangacoders.com\"> KangaCoders</a> is a team of qualified developers and true design artists. We are specialized in Mobile &amp; Web application development and also provide managed cloud-based services. To provide the highest possible quality we cover what we believe is the best selection of technologies out there, which obviously includes Ember.js!",
    "name": "Kanga Coders"
  }];

  for (var i = 0; i < sponsorList.length; i++) {
    sponsorList[i].id = String(i);
  }

  exports.sponsorList = sponsorList;

});
define('physical-design/routes/emberconf/sponsors/sponsor', ['exports', 'ember', 'physical-design/routes/emberconf/sponsors'], function (exports, Ember, sponsors) {

  'use strict';

  exports['default'] = Ember['default'].Route.extend({
    model: function model(params) {
      return sponsors.sponsorList.find(function (model) {
        return model.id === params.sponsor_id;
      });
    },

    setupController: function setupController(controller, model) {
      this._super(controller, model);
      sponsors.sponsorList.forEach(function (sponsor) {
        return Ember['default'].set(sponsor, "isActive", sponsor === model);
      });
    }

  });

});
define('physical-design/services/liquid-fire-modals', ['exports', 'liquid-fire/modals'], function (exports, Modals) {

	'use strict';

	exports['default'] = Modals['default'];

});
define('physical-design/services/liquid-fire-transitions', ['exports', 'liquid-fire/transition-map'], function (exports, TransitionMap) {

	'use strict';

	exports['default'] = TransitionMap['default'];

});
define('physical-design/templates/components/emberconf-footer', ['exports'], function (exports) {

  'use strict';

  exports['default'] = Ember.HTMLBars.template((function() {
    return {
      isHTMLBars: true,
      revision: "Ember@1.11.1",
      blockParams: 0,
      cachedFragment: null,
      hasRendered: false,
      build: function build(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createElement("footer");
        var el2 = dom.createTextNode("\n  ");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("p");
        dom.setAttribute(el2,"class","ownership");
        var el3 = dom.createTextNode("\n    ©2015 Tilde Inc");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("br");
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("a");
        dom.setAttribute(el3,"href","images/sponsors/15_EmberConf_V1.pdf");
        var el4 = dom.createTextNode("Download the Sponsorship Prospectus");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("span");
        var el4 = dom.createTextNode(" | ");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("a");
        dom.setAttribute(el3,"href","mailto:events@tilde.io");
        var el4 = dom.createTextNode("I'm ready to sponsor!");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("br");
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createComment(" Website by <a href=\"http://www.wearebunker.com/\">Bunker</a> ");
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n  ");
        dom.appendChild(el2, el3);
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n  ");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("p");
        dom.setAttribute(el2,"class","archive");
        var el3 = dom.createTextNode("Previous years");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("br");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("a");
        dom.setAttribute(el3,"href","http://2014.emberconf.com/");
        var el4 = dom.createTextNode("2014");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n");
        dom.appendChild(el1, el2);
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n");
        dom.appendChild(el0, el1);
        return el0;
      },
      render: function render(context, env, contextualElement) {
        var dom = env.dom;
        dom.detectNamespace(contextualElement);
        var fragment;
        if (env.useFragmentCache && dom.canClone) {
          if (this.cachedFragment === null) {
            fragment = this.build(dom);
            if (this.hasRendered) {
              this.cachedFragment = fragment;
            } else {
              this.hasRendered = true;
            }
          }
          if (this.cachedFragment) {
            fragment = dom.cloneNode(this.cachedFragment, true);
          }
        } else {
          fragment = this.build(dom);
        }
        return fragment;
      }
    };
  }()));

});
define('physical-design/templates/components/emberconf-header', ['exports'], function (exports) {

  'use strict';

  exports['default'] = Ember.HTMLBars.template((function() {
    var child0 = (function() {
      return {
        isHTMLBars: true,
        revision: "Ember@1.11.1",
        blockParams: 0,
        cachedFragment: null,
        hasRendered: false,
        build: function build(dom) {
          var el0 = dom.createDocumentFragment();
          var el1 = dom.createTextNode("Speakers");
          dom.appendChild(el0, el1);
          return el0;
        },
        render: function render(context, env, contextualElement) {
          var dom = env.dom;
          dom.detectNamespace(contextualElement);
          var fragment;
          if (env.useFragmentCache && dom.canClone) {
            if (this.cachedFragment === null) {
              fragment = this.build(dom);
              if (this.hasRendered) {
                this.cachedFragment = fragment;
              } else {
                this.hasRendered = true;
              }
            }
            if (this.cachedFragment) {
              fragment = dom.cloneNode(this.cachedFragment, true);
            }
          } else {
            fragment = this.build(dom);
          }
          return fragment;
        }
      };
    }());
    var child1 = (function() {
      return {
        isHTMLBars: true,
        revision: "Ember@1.11.1",
        blockParams: 0,
        cachedFragment: null,
        hasRendered: false,
        build: function build(dom) {
          var el0 = dom.createDocumentFragment();
          var el1 = dom.createTextNode("Sponsors");
          dom.appendChild(el0, el1);
          return el0;
        },
        render: function render(context, env, contextualElement) {
          var dom = env.dom;
          dom.detectNamespace(contextualElement);
          var fragment;
          if (env.useFragmentCache && dom.canClone) {
            if (this.cachedFragment === null) {
              fragment = this.build(dom);
              if (this.hasRendered) {
                this.cachedFragment = fragment;
              } else {
                this.hasRendered = true;
              }
            }
            if (this.cachedFragment) {
              fragment = dom.cloneNode(this.cachedFragment, true);
            }
          } else {
            fragment = this.build(dom);
          }
          return fragment;
        }
      };
    }());
    return {
      isHTMLBars: true,
      revision: "Ember@1.11.1",
      blockParams: 0,
      cachedFragment: null,
      hasRendered: false,
      build: function build(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createElement("header");
        dom.setAttribute(el1,"class","diagonal-2");
        var el2 = dom.createTextNode("\n  ");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("div");
        dom.setAttribute(el2,"class","header-box");
        var el3 = dom.createTextNode("\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("div");
        dom.setAttribute(el3,"class","logo-bg");
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("div");
        dom.setAttribute(el3,"class","logo");
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("a");
        dom.setAttribute(el4,"href","index.html");
        dom.setAttribute(el4,"alt","EmberConf 2015");
        var el5 = dom.createElement("img");
        dom.setAttribute(el5,"src","images/emberconf-logo-2.png");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n    ");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("nav");
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("div");
        dom.setAttribute(el4,"class","mobile-trigger");
        var el5 = dom.createTextNode("| | |");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("ul");
        var el5 = dom.createTextNode("\n	");
        dom.appendChild(el4, el5);
        var el5 = dom.createElement("li");
        var el6 = dom.createComment("");
        dom.appendChild(el5, el6);
        dom.appendChild(el4, el5);
        var el5 = dom.createTextNode("\n	");
        dom.appendChild(el4, el5);
        var el5 = dom.createElement("li");
        var el6 = dom.createElement("a");
        dom.setAttribute(el6,"href","schedule.html");
        var el7 = dom.createTextNode("Schedule");
        dom.appendChild(el6, el7);
        dom.appendChild(el5, el6);
        dom.appendChild(el4, el5);
        var el5 = dom.createTextNode("\n	");
        dom.appendChild(el4, el5);
        var el5 = dom.createElement("li");
        var el6 = dom.createComment("");
        dom.appendChild(el5, el6);
        dom.appendChild(el4, el5);
        var el5 = dom.createTextNode("\n	");
        dom.appendChild(el4, el5);
        var el5 = dom.createElement("li");
        var el6 = dom.createElement("a");
        dom.setAttribute(el6,"href","location.html");
        var el7 = dom.createTextNode("Location + Hotel");
        dom.appendChild(el6, el7);
        dom.appendChild(el5, el6);
        dom.appendChild(el4, el5);
        var el5 = dom.createTextNode("\n	");
        dom.appendChild(el4, el5);
        var el5 = dom.createElement("li");
        var el6 = dom.createElement("a");
        dom.setAttribute(el6,"href","about.html");
        var el7 = dom.createTextNode("About");
        dom.appendChild(el6, el7);
        dom.appendChild(el5, el6);
        dom.appendChild(el4, el5);
        var el5 = dom.createTextNode("\n      ");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n    ");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("div");
        dom.setAttribute(el3,"class","date");
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("p");
        var el5 = dom.createTextNode("MARCH 3-4 ");
        dom.appendChild(el4, el5);
        var el5 = dom.createElement("span");
        var el6 = dom.createTextNode("|");
        dom.appendChild(el5, el6);
        dom.appendChild(el4, el5);
        var el5 = dom.createTextNode(" PORTLAND, OR");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("h1");
        var el5 = dom.createTextNode("Speakers");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n    ");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n  ");
        dom.appendChild(el2, el3);
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n");
        dom.appendChild(el1, el2);
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n");
        dom.appendChild(el0, el1);
        return el0;
      },
      render: function render(context, env, contextualElement) {
        var dom = env.dom;
        var hooks = env.hooks, block = hooks.block;
        dom.detectNamespace(contextualElement);
        var fragment;
        if (env.useFragmentCache && dom.canClone) {
          if (this.cachedFragment === null) {
            fragment = this.build(dom);
            if (this.hasRendered) {
              this.cachedFragment = fragment;
            } else {
              this.hasRendered = true;
            }
          }
          if (this.cachedFragment) {
            fragment = dom.cloneNode(this.cachedFragment, true);
          }
        } else {
          fragment = this.build(dom);
        }
        var element0 = dom.childAt(fragment, [0, 1, 5, 3]);
        var morph0 = dom.createMorphAt(dom.childAt(element0, [1]),0,0);
        var morph1 = dom.createMorphAt(dom.childAt(element0, [5]),0,0);
        block(env, morph0, context, "link-to", ["emberconf.speakers"], {}, child0, null);
        block(env, morph1, context, "link-to", ["emberconf.sponsors"], {}, child1, null);
        return fragment;
      }
    };
  }()));

});
define('physical-design/templates/components/liquid-bind', ['exports'], function (exports) {

  'use strict';

  exports['default'] = Ember.HTMLBars.template((function() {
    var child0 = (function() {
      var child0 = (function() {
        return {
          isHTMLBars: true,
          revision: "Ember@1.11.1",
          blockParams: 1,
          cachedFragment: null,
          hasRendered: false,
          build: function build(dom) {
            var el0 = dom.createDocumentFragment();
            var el1 = dom.createComment("");
            dom.appendChild(el0, el1);
            return el0;
          },
          render: function render(context, env, contextualElement, blockArguments) {
            var dom = env.dom;
            var hooks = env.hooks, set = hooks.set, content = hooks.content;
            dom.detectNamespace(contextualElement);
            var fragment;
            if (env.useFragmentCache && dom.canClone) {
              if (this.cachedFragment === null) {
                fragment = this.build(dom);
                if (this.hasRendered) {
                  this.cachedFragment = fragment;
                } else {
                  this.hasRendered = true;
                }
              }
              if (this.cachedFragment) {
                fragment = dom.cloneNode(this.cachedFragment, true);
              }
            } else {
              fragment = this.build(dom);
            }
            var morph0 = dom.createMorphAt(fragment,0,0,contextualElement);
            dom.insertBoundary(fragment, null);
            dom.insertBoundary(fragment, 0);
            set(env, context, "version", blockArguments[0]);
            content(env, morph0, context, "version");
            return fragment;
          }
        };
      }());
      return {
        isHTMLBars: true,
        revision: "Ember@1.11.1",
        blockParams: 0,
        cachedFragment: null,
        hasRendered: false,
        build: function build(dom) {
          var el0 = dom.createDocumentFragment();
          var el1 = dom.createComment("");
          dom.appendChild(el0, el1);
          return el0;
        },
        render: function render(context, env, contextualElement) {
          var dom = env.dom;
          var hooks = env.hooks, get = hooks.get, block = hooks.block;
          dom.detectNamespace(contextualElement);
          var fragment;
          if (env.useFragmentCache && dom.canClone) {
            if (this.cachedFragment === null) {
              fragment = this.build(dom);
              if (this.hasRendered) {
                this.cachedFragment = fragment;
              } else {
                this.hasRendered = true;
              }
            }
            if (this.cachedFragment) {
              fragment = dom.cloneNode(this.cachedFragment, true);
            }
          } else {
            fragment = this.build(dom);
          }
          var morph0 = dom.createMorphAt(fragment,0,0,contextualElement);
          dom.insertBoundary(fragment, null);
          dom.insertBoundary(fragment, 0);
          block(env, morph0, context, "liquid-versions", [], {"value": get(env, context, "value"), "use": get(env, context, "use"), "name": "liquid-bind", "renderWhenFalse": true, "innerClass": get(env, context, "innerClass")}, child0, null);
          return fragment;
        }
      };
    }());
    var child1 = (function() {
      var child0 = (function() {
        var child0 = (function() {
          return {
            isHTMLBars: true,
            revision: "Ember@1.11.1",
            blockParams: 1,
            cachedFragment: null,
            hasRendered: false,
            build: function build(dom) {
              var el0 = dom.createDocumentFragment();
              var el1 = dom.createComment("");
              dom.appendChild(el0, el1);
              return el0;
            },
            render: function render(context, env, contextualElement, blockArguments) {
              var dom = env.dom;
              var hooks = env.hooks, set = hooks.set, content = hooks.content;
              dom.detectNamespace(contextualElement);
              var fragment;
              if (env.useFragmentCache && dom.canClone) {
                if (this.cachedFragment === null) {
                  fragment = this.build(dom);
                  if (this.hasRendered) {
                    this.cachedFragment = fragment;
                  } else {
                    this.hasRendered = true;
                  }
                }
                if (this.cachedFragment) {
                  fragment = dom.cloneNode(this.cachedFragment, true);
                }
              } else {
                fragment = this.build(dom);
              }
              var morph0 = dom.createMorphAt(fragment,0,0,contextualElement);
              dom.insertBoundary(fragment, null);
              dom.insertBoundary(fragment, 0);
              set(env, context, "version", blockArguments[0]);
              content(env, morph0, context, "version");
              return fragment;
            }
          };
        }());
        return {
          isHTMLBars: true,
          revision: "Ember@1.11.1",
          blockParams: 1,
          cachedFragment: null,
          hasRendered: false,
          build: function build(dom) {
            var el0 = dom.createDocumentFragment();
            var el1 = dom.createComment("");
            dom.appendChild(el0, el1);
            return el0;
          },
          render: function render(context, env, contextualElement, blockArguments) {
            var dom = env.dom;
            var hooks = env.hooks, set = hooks.set, get = hooks.get, block = hooks.block;
            dom.detectNamespace(contextualElement);
            var fragment;
            if (env.useFragmentCache && dom.canClone) {
              if (this.cachedFragment === null) {
                fragment = this.build(dom);
                if (this.hasRendered) {
                  this.cachedFragment = fragment;
                } else {
                  this.hasRendered = true;
                }
              }
              if (this.cachedFragment) {
                fragment = dom.cloneNode(this.cachedFragment, true);
              }
            } else {
              fragment = this.build(dom);
            }
            var morph0 = dom.createMorphAt(fragment,0,0,contextualElement);
            dom.insertBoundary(fragment, null);
            dom.insertBoundary(fragment, 0);
            set(env, context, "container", blockArguments[0]);
            block(env, morph0, context, "liquid-versions", [], {"value": get(env, context, "value"), "notify": get(env, context, "container"), "use": get(env, context, "use"), "name": "liquid-bind", "renderWhenFalse": true}, child0, null);
            return fragment;
          }
        };
      }());
      return {
        isHTMLBars: true,
        revision: "Ember@1.11.1",
        blockParams: 0,
        cachedFragment: null,
        hasRendered: false,
        build: function build(dom) {
          var el0 = dom.createDocumentFragment();
          var el1 = dom.createComment("");
          dom.appendChild(el0, el1);
          return el0;
        },
        render: function render(context, env, contextualElement) {
          var dom = env.dom;
          var hooks = env.hooks, get = hooks.get, block = hooks.block;
          dom.detectNamespace(contextualElement);
          var fragment;
          if (env.useFragmentCache && dom.canClone) {
            if (this.cachedFragment === null) {
              fragment = this.build(dom);
              if (this.hasRendered) {
                this.cachedFragment = fragment;
              } else {
                this.hasRendered = true;
              }
            }
            if (this.cachedFragment) {
              fragment = dom.cloneNode(this.cachedFragment, true);
            }
          } else {
            fragment = this.build(dom);
          }
          var morph0 = dom.createMorphAt(fragment,0,0,contextualElement);
          dom.insertBoundary(fragment, null);
          dom.insertBoundary(fragment, 0);
          block(env, morph0, context, "liquid-container", [], {"id": get(env, context, "innerId"), "class": get(env, context, "innerClass")}, child0, null);
          return fragment;
        }
      };
    }());
    return {
      isHTMLBars: true,
      revision: "Ember@1.11.1",
      blockParams: 0,
      cachedFragment: null,
      hasRendered: false,
      build: function build(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createComment("");
        dom.appendChild(el0, el1);
        return el0;
      },
      render: function render(context, env, contextualElement) {
        var dom = env.dom;
        var hooks = env.hooks, get = hooks.get, block = hooks.block;
        dom.detectNamespace(contextualElement);
        var fragment;
        if (env.useFragmentCache && dom.canClone) {
          if (this.cachedFragment === null) {
            fragment = this.build(dom);
            if (this.hasRendered) {
              this.cachedFragment = fragment;
            } else {
              this.hasRendered = true;
            }
          }
          if (this.cachedFragment) {
            fragment = dom.cloneNode(this.cachedFragment, true);
          }
        } else {
          fragment = this.build(dom);
        }
        var morph0 = dom.createMorphAt(fragment,0,0,contextualElement);
        dom.insertBoundary(fragment, null);
        dom.insertBoundary(fragment, 0);
        block(env, morph0, context, "if", [get(env, context, "containerless")], {}, child0, child1);
        return fragment;
      }
    };
  }()));

});
define('physical-design/templates/components/liquid-container', ['exports'], function (exports) {

  'use strict';

  exports['default'] = Ember.HTMLBars.template((function() {
    return {
      isHTMLBars: true,
      revision: "Ember@1.11.1",
      blockParams: 0,
      cachedFragment: null,
      hasRendered: false,
      build: function build(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createComment("");
        dom.appendChild(el0, el1);
        return el0;
      },
      render: function render(context, env, contextualElement) {
        var dom = env.dom;
        var hooks = env.hooks, get = hooks.get, inline = hooks.inline;
        dom.detectNamespace(contextualElement);
        var fragment;
        if (env.useFragmentCache && dom.canClone) {
          if (this.cachedFragment === null) {
            fragment = this.build(dom);
            if (this.hasRendered) {
              this.cachedFragment = fragment;
            } else {
              this.hasRendered = true;
            }
          }
          if (this.cachedFragment) {
            fragment = dom.cloneNode(this.cachedFragment, true);
          }
        } else {
          fragment = this.build(dom);
        }
        var morph0 = dom.createMorphAt(fragment,0,0,contextualElement);
        dom.insertBoundary(fragment, null);
        dom.insertBoundary(fragment, 0);
        inline(env, morph0, context, "yield", [get(env, context, "this")], {});
        return fragment;
      }
    };
  }()));

});
define('physical-design/templates/components/liquid-if', ['exports'], function (exports) {

  'use strict';

  exports['default'] = Ember.HTMLBars.template((function() {
    var child0 = (function() {
      var child0 = (function() {
        var child0 = (function() {
          return {
            isHTMLBars: true,
            revision: "Ember@1.11.1",
            blockParams: 0,
            cachedFragment: null,
            hasRendered: false,
            build: function build(dom) {
              var el0 = dom.createDocumentFragment();
              var el1 = dom.createTextNode("      ");
              dom.appendChild(el0, el1);
              var el1 = dom.createComment("");
              dom.appendChild(el0, el1);
              var el1 = dom.createTextNode("\n");
              dom.appendChild(el0, el1);
              return el0;
            },
            render: function render(context, env, contextualElement) {
              var dom = env.dom;
              var hooks = env.hooks, content = hooks.content;
              dom.detectNamespace(contextualElement);
              var fragment;
              if (env.useFragmentCache && dom.canClone) {
                if (this.cachedFragment === null) {
                  fragment = this.build(dom);
                  if (this.hasRendered) {
                    this.cachedFragment = fragment;
                  } else {
                    this.hasRendered = true;
                  }
                }
                if (this.cachedFragment) {
                  fragment = dom.cloneNode(this.cachedFragment, true);
                }
              } else {
                fragment = this.build(dom);
              }
              var morph0 = dom.createMorphAt(fragment,1,1,contextualElement);
              content(env, morph0, context, "yield");
              return fragment;
            }
          };
        }());
        var child1 = (function() {
          return {
            isHTMLBars: true,
            revision: "Ember@1.11.1",
            blockParams: 0,
            cachedFragment: null,
            hasRendered: false,
            build: function build(dom) {
              var el0 = dom.createDocumentFragment();
              var el1 = dom.createTextNode("      ");
              dom.appendChild(el0, el1);
              var el1 = dom.createComment("");
              dom.appendChild(el0, el1);
              var el1 = dom.createTextNode("\n");
              dom.appendChild(el0, el1);
              return el0;
            },
            render: function render(context, env, contextualElement) {
              var dom = env.dom;
              var hooks = env.hooks, content = hooks.content;
              dom.detectNamespace(contextualElement);
              var fragment;
              if (env.useFragmentCache && dom.canClone) {
                if (this.cachedFragment === null) {
                  fragment = this.build(dom);
                  if (this.hasRendered) {
                    this.cachedFragment = fragment;
                  } else {
                    this.hasRendered = true;
                  }
                }
                if (this.cachedFragment) {
                  fragment = dom.cloneNode(this.cachedFragment, true);
                }
              } else {
                fragment = this.build(dom);
              }
              var morph0 = dom.createMorphAt(fragment,1,1,contextualElement);
              content(env, morph0, context, "lf-yield-inverse");
              return fragment;
            }
          };
        }());
        return {
          isHTMLBars: true,
          revision: "Ember@1.11.1",
          blockParams: 1,
          cachedFragment: null,
          hasRendered: false,
          build: function build(dom) {
            var el0 = dom.createDocumentFragment();
            var el1 = dom.createComment("");
            dom.appendChild(el0, el1);
            return el0;
          },
          render: function render(context, env, contextualElement, blockArguments) {
            var dom = env.dom;
            var hooks = env.hooks, set = hooks.set, get = hooks.get, block = hooks.block;
            dom.detectNamespace(contextualElement);
            var fragment;
            if (env.useFragmentCache && dom.canClone) {
              if (this.cachedFragment === null) {
                fragment = this.build(dom);
                if (this.hasRendered) {
                  this.cachedFragment = fragment;
                } else {
                  this.hasRendered = true;
                }
              }
              if (this.cachedFragment) {
                fragment = dom.cloneNode(this.cachedFragment, true);
              }
            } else {
              fragment = this.build(dom);
            }
            var morph0 = dom.createMorphAt(fragment,0,0,contextualElement);
            dom.insertBoundary(fragment, null);
            dom.insertBoundary(fragment, 0);
            set(env, context, "valueVersion", blockArguments[0]);
            block(env, morph0, context, "if", [get(env, context, "valueVersion")], {}, child0, child1);
            return fragment;
          }
        };
      }());
      return {
        isHTMLBars: true,
        revision: "Ember@1.11.1",
        blockParams: 0,
        cachedFragment: null,
        hasRendered: false,
        build: function build(dom) {
          var el0 = dom.createDocumentFragment();
          var el1 = dom.createComment("");
          dom.appendChild(el0, el1);
          return el0;
        },
        render: function render(context, env, contextualElement) {
          var dom = env.dom;
          var hooks = env.hooks, get = hooks.get, block = hooks.block;
          dom.detectNamespace(contextualElement);
          var fragment;
          if (env.useFragmentCache && dom.canClone) {
            if (this.cachedFragment === null) {
              fragment = this.build(dom);
              if (this.hasRendered) {
                this.cachedFragment = fragment;
              } else {
                this.hasRendered = true;
              }
            }
            if (this.cachedFragment) {
              fragment = dom.cloneNode(this.cachedFragment, true);
            }
          } else {
            fragment = this.build(dom);
          }
          var morph0 = dom.createMorphAt(fragment,0,0,contextualElement);
          dom.insertBoundary(fragment, null);
          dom.insertBoundary(fragment, 0);
          block(env, morph0, context, "liquid-versions", [], {"value": get(env, context, "value"), "name": get(env, context, "helperName"), "use": get(env, context, "use"), "renderWhenFalse": get(env, context, "hasInverse"), "innerClass": get(env, context, "innerClass")}, child0, null);
          return fragment;
        }
      };
    }());
    var child1 = (function() {
      var child0 = (function() {
        var child0 = (function() {
          var child0 = (function() {
            return {
              isHTMLBars: true,
              revision: "Ember@1.11.1",
              blockParams: 0,
              cachedFragment: null,
              hasRendered: false,
              build: function build(dom) {
                var el0 = dom.createDocumentFragment();
                var el1 = dom.createTextNode("        ");
                dom.appendChild(el0, el1);
                var el1 = dom.createComment("");
                dom.appendChild(el0, el1);
                var el1 = dom.createTextNode("\n");
                dom.appendChild(el0, el1);
                return el0;
              },
              render: function render(context, env, contextualElement) {
                var dom = env.dom;
                var hooks = env.hooks, content = hooks.content;
                dom.detectNamespace(contextualElement);
                var fragment;
                if (env.useFragmentCache && dom.canClone) {
                  if (this.cachedFragment === null) {
                    fragment = this.build(dom);
                    if (this.hasRendered) {
                      this.cachedFragment = fragment;
                    } else {
                      this.hasRendered = true;
                    }
                  }
                  if (this.cachedFragment) {
                    fragment = dom.cloneNode(this.cachedFragment, true);
                  }
                } else {
                  fragment = this.build(dom);
                }
                var morph0 = dom.createMorphAt(fragment,1,1,contextualElement);
                content(env, morph0, context, "yield");
                return fragment;
              }
            };
          }());
          var child1 = (function() {
            return {
              isHTMLBars: true,
              revision: "Ember@1.11.1",
              blockParams: 0,
              cachedFragment: null,
              hasRendered: false,
              build: function build(dom) {
                var el0 = dom.createDocumentFragment();
                var el1 = dom.createTextNode("        ");
                dom.appendChild(el0, el1);
                var el1 = dom.createComment("");
                dom.appendChild(el0, el1);
                var el1 = dom.createTextNode("\n");
                dom.appendChild(el0, el1);
                return el0;
              },
              render: function render(context, env, contextualElement) {
                var dom = env.dom;
                var hooks = env.hooks, content = hooks.content;
                dom.detectNamespace(contextualElement);
                var fragment;
                if (env.useFragmentCache && dom.canClone) {
                  if (this.cachedFragment === null) {
                    fragment = this.build(dom);
                    if (this.hasRendered) {
                      this.cachedFragment = fragment;
                    } else {
                      this.hasRendered = true;
                    }
                  }
                  if (this.cachedFragment) {
                    fragment = dom.cloneNode(this.cachedFragment, true);
                  }
                } else {
                  fragment = this.build(dom);
                }
                var morph0 = dom.createMorphAt(fragment,1,1,contextualElement);
                content(env, morph0, context, "lf-yield-inverse");
                return fragment;
              }
            };
          }());
          return {
            isHTMLBars: true,
            revision: "Ember@1.11.1",
            blockParams: 1,
            cachedFragment: null,
            hasRendered: false,
            build: function build(dom) {
              var el0 = dom.createDocumentFragment();
              var el1 = dom.createComment("");
              dom.appendChild(el0, el1);
              return el0;
            },
            render: function render(context, env, contextualElement, blockArguments) {
              var dom = env.dom;
              var hooks = env.hooks, set = hooks.set, get = hooks.get, block = hooks.block;
              dom.detectNamespace(contextualElement);
              var fragment;
              if (env.useFragmentCache && dom.canClone) {
                if (this.cachedFragment === null) {
                  fragment = this.build(dom);
                  if (this.hasRendered) {
                    this.cachedFragment = fragment;
                  } else {
                    this.hasRendered = true;
                  }
                }
                if (this.cachedFragment) {
                  fragment = dom.cloneNode(this.cachedFragment, true);
                }
              } else {
                fragment = this.build(dom);
              }
              var morph0 = dom.createMorphAt(fragment,0,0,contextualElement);
              dom.insertBoundary(fragment, null);
              dom.insertBoundary(fragment, 0);
              set(env, context, "valueVersion", blockArguments[0]);
              block(env, morph0, context, "if", [get(env, context, "valueVersion")], {}, child0, child1);
              return fragment;
            }
          };
        }());
        return {
          isHTMLBars: true,
          revision: "Ember@1.11.1",
          blockParams: 1,
          cachedFragment: null,
          hasRendered: false,
          build: function build(dom) {
            var el0 = dom.createDocumentFragment();
            var el1 = dom.createComment("");
            dom.appendChild(el0, el1);
            return el0;
          },
          render: function render(context, env, contextualElement, blockArguments) {
            var dom = env.dom;
            var hooks = env.hooks, set = hooks.set, get = hooks.get, block = hooks.block;
            dom.detectNamespace(contextualElement);
            var fragment;
            if (env.useFragmentCache && dom.canClone) {
              if (this.cachedFragment === null) {
                fragment = this.build(dom);
                if (this.hasRendered) {
                  this.cachedFragment = fragment;
                } else {
                  this.hasRendered = true;
                }
              }
              if (this.cachedFragment) {
                fragment = dom.cloneNode(this.cachedFragment, true);
              }
            } else {
              fragment = this.build(dom);
            }
            var morph0 = dom.createMorphAt(fragment,0,0,contextualElement);
            dom.insertBoundary(fragment, null);
            dom.insertBoundary(fragment, 0);
            set(env, context, "container", blockArguments[0]);
            block(env, morph0, context, "liquid-versions", [], {"value": get(env, context, "value"), "notify": get(env, context, "container"), "name": get(env, context, "helperName"), "use": get(env, context, "use"), "renderWhenFalse": get(env, context, "hasInverse")}, child0, null);
            return fragment;
          }
        };
      }());
      return {
        isHTMLBars: true,
        revision: "Ember@1.11.1",
        blockParams: 0,
        cachedFragment: null,
        hasRendered: false,
        build: function build(dom) {
          var el0 = dom.createDocumentFragment();
          var el1 = dom.createComment("");
          dom.appendChild(el0, el1);
          return el0;
        },
        render: function render(context, env, contextualElement) {
          var dom = env.dom;
          var hooks = env.hooks, get = hooks.get, block = hooks.block;
          dom.detectNamespace(contextualElement);
          var fragment;
          if (env.useFragmentCache && dom.canClone) {
            if (this.cachedFragment === null) {
              fragment = this.build(dom);
              if (this.hasRendered) {
                this.cachedFragment = fragment;
              } else {
                this.hasRendered = true;
              }
            }
            if (this.cachedFragment) {
              fragment = dom.cloneNode(this.cachedFragment, true);
            }
          } else {
            fragment = this.build(dom);
          }
          var morph0 = dom.createMorphAt(fragment,0,0,contextualElement);
          dom.insertBoundary(fragment, null);
          dom.insertBoundary(fragment, 0);
          block(env, morph0, context, "liquid-container", [], {"id": get(env, context, "innerId"), "class": get(env, context, "innerClass")}, child0, null);
          return fragment;
        }
      };
    }());
    return {
      isHTMLBars: true,
      revision: "Ember@1.11.1",
      blockParams: 0,
      cachedFragment: null,
      hasRendered: false,
      build: function build(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createComment("");
        dom.appendChild(el0, el1);
        return el0;
      },
      render: function render(context, env, contextualElement) {
        var dom = env.dom;
        var hooks = env.hooks, get = hooks.get, block = hooks.block;
        dom.detectNamespace(contextualElement);
        var fragment;
        if (env.useFragmentCache && dom.canClone) {
          if (this.cachedFragment === null) {
            fragment = this.build(dom);
            if (this.hasRendered) {
              this.cachedFragment = fragment;
            } else {
              this.hasRendered = true;
            }
          }
          if (this.cachedFragment) {
            fragment = dom.cloneNode(this.cachedFragment, true);
          }
        } else {
          fragment = this.build(dom);
        }
        var morph0 = dom.createMorphAt(fragment,0,0,contextualElement);
        dom.insertBoundary(fragment, null);
        dom.insertBoundary(fragment, 0);
        block(env, morph0, context, "if", [get(env, context, "containerless")], {}, child0, child1);
        return fragment;
      }
    };
  }()));

});
define('physical-design/templates/components/liquid-measured', ['exports'], function (exports) {

  'use strict';

  exports['default'] = Ember.HTMLBars.template((function() {
    return {
      isHTMLBars: true,
      revision: "Ember@1.11.1",
      blockParams: 0,
      cachedFragment: null,
      hasRendered: false,
      build: function build(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createComment("");
        dom.appendChild(el0, el1);
        return el0;
      },
      render: function render(context, env, contextualElement) {
        var dom = env.dom;
        var hooks = env.hooks, content = hooks.content;
        dom.detectNamespace(contextualElement);
        var fragment;
        if (env.useFragmentCache && dom.canClone) {
          if (this.cachedFragment === null) {
            fragment = this.build(dom);
            if (this.hasRendered) {
              this.cachedFragment = fragment;
            } else {
              this.hasRendered = true;
            }
          }
          if (this.cachedFragment) {
            fragment = dom.cloneNode(this.cachedFragment, true);
          }
        } else {
          fragment = this.build(dom);
        }
        var morph0 = dom.createMorphAt(fragment,0,0,contextualElement);
        dom.insertBoundary(fragment, null);
        dom.insertBoundary(fragment, 0);
        content(env, morph0, context, "yield");
        return fragment;
      }
    };
  }()));

});
define('physical-design/templates/components/liquid-modal', ['exports'], function (exports) {

  'use strict';

  exports['default'] = Ember.HTMLBars.template((function() {
    var child0 = (function() {
      var child0 = (function() {
        return {
          isHTMLBars: true,
          revision: "Ember@1.11.1",
          blockParams: 0,
          cachedFragment: null,
          hasRendered: false,
          build: function build(dom) {
            var el0 = dom.createDocumentFragment();
            var el1 = dom.createTextNode("    ");
            dom.appendChild(el0, el1);
            var el1 = dom.createElement("div");
            dom.setAttribute(el1,"role","dialog");
            var el2 = dom.createTextNode("\n      ");
            dom.appendChild(el1, el2);
            var el2 = dom.createComment("");
            dom.appendChild(el1, el2);
            var el2 = dom.createTextNode("\n    ");
            dom.appendChild(el1, el2);
            dom.appendChild(el0, el1);
            var el1 = dom.createTextNode("\n");
            dom.appendChild(el0, el1);
            return el0;
          },
          render: function render(context, env, contextualElement) {
            var dom = env.dom;
            var hooks = env.hooks, element = hooks.element, get = hooks.get, inline = hooks.inline;
            dom.detectNamespace(contextualElement);
            var fragment;
            if (env.useFragmentCache && dom.canClone) {
              if (this.cachedFragment === null) {
                fragment = this.build(dom);
                if (this.hasRendered) {
                  this.cachedFragment = fragment;
                } else {
                  this.hasRendered = true;
                }
              }
              if (this.cachedFragment) {
                fragment = dom.cloneNode(this.cachedFragment, true);
              }
            } else {
              fragment = this.build(dom);
            }
            var element0 = dom.childAt(fragment, [1]);
            var morph0 = dom.createMorphAt(element0,1,1);
            element(env, element0, context, "bind-attr", [], {"class": ":lf-dialog cc.options.dialogClass"});
            element(env, element0, context, "bind-attr", [], {"aria-labelledby": "cc.options.ariaLabelledBy", "aria-label": "cc.options.ariaLabel"});
            inline(env, morph0, context, "view", [get(env, context, "innerView")], {"dismiss": "dismiss"});
            return fragment;
          }
        };
      }());
      return {
        isHTMLBars: true,
        revision: "Ember@1.11.1",
        blockParams: 1,
        cachedFragment: null,
        hasRendered: false,
        build: function build(dom) {
          var el0 = dom.createDocumentFragment();
          var el1 = dom.createComment("");
          dom.appendChild(el0, el1);
          var el1 = dom.createTextNode("  ");
          dom.appendChild(el0, el1);
          var el1 = dom.createComment("");
          dom.appendChild(el0, el1);
          var el1 = dom.createTextNode("\n");
          dom.appendChild(el0, el1);
          return el0;
        },
        render: function render(context, env, contextualElement, blockArguments) {
          var dom = env.dom;
          var hooks = env.hooks, set = hooks.set, block = hooks.block, content = hooks.content;
          dom.detectNamespace(contextualElement);
          var fragment;
          if (env.useFragmentCache && dom.canClone) {
            if (this.cachedFragment === null) {
              fragment = this.build(dom);
              if (this.hasRendered) {
                this.cachedFragment = fragment;
              } else {
                this.hasRendered = true;
              }
            }
            if (this.cachedFragment) {
              fragment = dom.cloneNode(this.cachedFragment, true);
            }
          } else {
            fragment = this.build(dom);
          }
          var morph0 = dom.createMorphAt(fragment,0,0,contextualElement);
          var morph1 = dom.createMorphAt(fragment,2,2,contextualElement);
          dom.insertBoundary(fragment, 0);
          set(env, context, "cc", blockArguments[0]);
          block(env, morph0, context, "lm-container", [], {"action": "escape", "clickAway": "outsideClick"}, child0, null);
          content(env, morph1, context, "lf-overlay");
          return fragment;
        }
      };
    }());
    return {
      isHTMLBars: true,
      revision: "Ember@1.11.1",
      blockParams: 0,
      cachedFragment: null,
      hasRendered: false,
      build: function build(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createComment("");
        dom.appendChild(el0, el1);
        return el0;
      },
      render: function render(context, env, contextualElement) {
        var dom = env.dom;
        var hooks = env.hooks, get = hooks.get, block = hooks.block;
        dom.detectNamespace(contextualElement);
        var fragment;
        if (env.useFragmentCache && dom.canClone) {
          if (this.cachedFragment === null) {
            fragment = this.build(dom);
            if (this.hasRendered) {
              this.cachedFragment = fragment;
            } else {
              this.hasRendered = true;
            }
          }
          if (this.cachedFragment) {
            fragment = dom.cloneNode(this.cachedFragment, true);
          }
        } else {
          fragment = this.build(dom);
        }
        var morph0 = dom.createMorphAt(fragment,0,0,contextualElement);
        dom.insertBoundary(fragment, null);
        dom.insertBoundary(fragment, 0);
        block(env, morph0, context, "liquid-versions", [], {"name": "liquid-modal", "value": get(env, context, "currentContext")}, child0, null);
        return fragment;
      }
    };
  }()));

});
define('physical-design/templates/components/liquid-outlet', ['exports'], function (exports) {

  'use strict';

  exports['default'] = Ember.HTMLBars.template((function() {
    var child0 = (function() {
      return {
        isHTMLBars: true,
        revision: "Ember@1.11.1",
        blockParams: 1,
        cachedFragment: null,
        hasRendered: false,
        build: function build(dom) {
          var el0 = dom.createDocumentFragment();
          var el1 = dom.createComment("");
          dom.appendChild(el0, el1);
          return el0;
        },
        render: function render(context, env, contextualElement, blockArguments) {
          var dom = env.dom;
          var hooks = env.hooks, set = hooks.set, get = hooks.get, inline = hooks.inline;
          dom.detectNamespace(contextualElement);
          var fragment;
          if (env.useFragmentCache && dom.canClone) {
            if (this.cachedFragment === null) {
              fragment = this.build(dom);
              if (this.hasRendered) {
                this.cachedFragment = fragment;
              } else {
                this.hasRendered = true;
              }
            }
            if (this.cachedFragment) {
              fragment = dom.cloneNode(this.cachedFragment, true);
            }
          } else {
            fragment = this.build(dom);
          }
          var morph0 = dom.createMorphAt(fragment,0,0,contextualElement);
          dom.insertBoundary(fragment, null);
          dom.insertBoundary(fragment, 0);
          set(env, context, "outletStateVersion", blockArguments[0]);
          inline(env, morph0, context, "lf-outlet", [], {"staticState": get(env, context, "outletStateVersion")});
          return fragment;
        }
      };
    }());
    return {
      isHTMLBars: true,
      revision: "Ember@1.11.1",
      blockParams: 0,
      cachedFragment: null,
      hasRendered: false,
      build: function build(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createComment("");
        dom.appendChild(el0, el1);
        return el0;
      },
      render: function render(context, env, contextualElement) {
        var dom = env.dom;
        var hooks = env.hooks, get = hooks.get, block = hooks.block;
        dom.detectNamespace(contextualElement);
        var fragment;
        if (env.useFragmentCache && dom.canClone) {
          if (this.cachedFragment === null) {
            fragment = this.build(dom);
            if (this.hasRendered) {
              this.cachedFragment = fragment;
            } else {
              this.hasRendered = true;
            }
          }
          if (this.cachedFragment) {
            fragment = dom.cloneNode(this.cachedFragment, true);
          }
        } else {
          fragment = this.build(dom);
        }
        var morph0 = dom.createMorphAt(fragment,0,0,contextualElement);
        dom.insertBoundary(fragment, null);
        dom.insertBoundary(fragment, 0);
        block(env, morph0, context, "liquid-with", [get(env, context, "outletState")], {"id": get(env, context, "innerId"), "class": get(env, context, "innerClass"), "use": get(env, context, "use"), "name": "liquid-outlet", "containerless": get(env, context, "containerless")}, child0, null);
        return fragment;
      }
    };
  }()));

});
define('physical-design/templates/components/liquid-spacer', ['exports'], function (exports) {

  'use strict';

  exports['default'] = Ember.HTMLBars.template((function() {
    var child0 = (function() {
      return {
        isHTMLBars: true,
        revision: "Ember@1.11.1",
        blockParams: 0,
        cachedFragment: null,
        hasRendered: false,
        build: function build(dom) {
          var el0 = dom.createDocumentFragment();
          var el1 = dom.createTextNode("  ");
          dom.appendChild(el0, el1);
          var el1 = dom.createComment("");
          dom.appendChild(el0, el1);
          var el1 = dom.createTextNode("\n");
          dom.appendChild(el0, el1);
          return el0;
        },
        render: function render(context, env, contextualElement) {
          var dom = env.dom;
          var hooks = env.hooks, content = hooks.content;
          dom.detectNamespace(contextualElement);
          var fragment;
          if (env.useFragmentCache && dom.canClone) {
            if (this.cachedFragment === null) {
              fragment = this.build(dom);
              if (this.hasRendered) {
                this.cachedFragment = fragment;
              } else {
                this.hasRendered = true;
              }
            }
            if (this.cachedFragment) {
              fragment = dom.cloneNode(this.cachedFragment, true);
            }
          } else {
            fragment = this.build(dom);
          }
          var morph0 = dom.createMorphAt(fragment,1,1,contextualElement);
          content(env, morph0, context, "yield");
          return fragment;
        }
      };
    }());
    return {
      isHTMLBars: true,
      revision: "Ember@1.11.1",
      blockParams: 0,
      cachedFragment: null,
      hasRendered: false,
      build: function build(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createComment("");
        dom.appendChild(el0, el1);
        return el0;
      },
      render: function render(context, env, contextualElement) {
        var dom = env.dom;
        var hooks = env.hooks, get = hooks.get, block = hooks.block;
        dom.detectNamespace(contextualElement);
        var fragment;
        if (env.useFragmentCache && dom.canClone) {
          if (this.cachedFragment === null) {
            fragment = this.build(dom);
            if (this.hasRendered) {
              this.cachedFragment = fragment;
            } else {
              this.hasRendered = true;
            }
          }
          if (this.cachedFragment) {
            fragment = dom.cloneNode(this.cachedFragment, true);
          }
        } else {
          fragment = this.build(dom);
        }
        var morph0 = dom.createMorphAt(fragment,0,0,contextualElement);
        dom.insertBoundary(fragment, null);
        dom.insertBoundary(fragment, 0);
        block(env, morph0, context, "liquid-measured", [], {"measurements": get(env, context, "measurements")}, child0, null);
        return fragment;
      }
    };
  }()));

});
define('physical-design/templates/components/liquid-versions', ['exports'], function (exports) {

  'use strict';

  exports['default'] = Ember.HTMLBars.template((function() {
    var child0 = (function() {
      var child0 = (function() {
        var child0 = (function() {
          return {
            isHTMLBars: true,
            revision: "Ember@1.11.1",
            blockParams: 0,
            cachedFragment: null,
            hasRendered: false,
            build: function build(dom) {
              var el0 = dom.createDocumentFragment();
              var el1 = dom.createComment("");
              dom.appendChild(el0, el1);
              return el0;
            },
            render: function render(context, env, contextualElement) {
              var dom = env.dom;
              var hooks = env.hooks, get = hooks.get, inline = hooks.inline;
              dom.detectNamespace(contextualElement);
              var fragment;
              if (env.useFragmentCache && dom.canClone) {
                if (this.cachedFragment === null) {
                  fragment = this.build(dom);
                  if (this.hasRendered) {
                    this.cachedFragment = fragment;
                  } else {
                    this.hasRendered = true;
                  }
                }
                if (this.cachedFragment) {
                  fragment = dom.cloneNode(this.cachedFragment, true);
                }
              } else {
                fragment = this.build(dom);
              }
              var morph0 = dom.createMorphAt(fragment,0,0,contextualElement);
              dom.insertBoundary(fragment, null);
              dom.insertBoundary(fragment, 0);
              inline(env, morph0, context, "yield", [get(env, context, "version.value")], {});
              return fragment;
            }
          };
        }());
        return {
          isHTMLBars: true,
          revision: "Ember@1.11.1",
          blockParams: 0,
          cachedFragment: null,
          hasRendered: false,
          build: function build(dom) {
            var el0 = dom.createDocumentFragment();
            var el1 = dom.createComment("");
            dom.appendChild(el0, el1);
            return el0;
          },
          render: function render(context, env, contextualElement) {
            var dom = env.dom;
            var hooks = env.hooks, get = hooks.get, block = hooks.block;
            dom.detectNamespace(contextualElement);
            var fragment;
            if (env.useFragmentCache && dom.canClone) {
              if (this.cachedFragment === null) {
                fragment = this.build(dom);
                if (this.hasRendered) {
                  this.cachedFragment = fragment;
                } else {
                  this.hasRendered = true;
                }
              }
              if (this.cachedFragment) {
                fragment = dom.cloneNode(this.cachedFragment, true);
              }
            } else {
              fragment = this.build(dom);
            }
            var morph0 = dom.createMorphAt(fragment,0,0,contextualElement);
            dom.insertBoundary(fragment, null);
            dom.insertBoundary(fragment, 0);
            block(env, morph0, context, "liquid-child", [], {"version": get(env, context, "version"), "visible": false, "didRender": "childDidRender", "class": get(env, context, "innerClass")}, child0, null);
            return fragment;
          }
        };
      }());
      return {
        isHTMLBars: true,
        revision: "Ember@1.11.1",
        blockParams: 1,
        cachedFragment: null,
        hasRendered: false,
        build: function build(dom) {
          var el0 = dom.createDocumentFragment();
          var el1 = dom.createComment("");
          dom.appendChild(el0, el1);
          return el0;
        },
        render: function render(context, env, contextualElement, blockArguments) {
          var dom = env.dom;
          var hooks = env.hooks, set = hooks.set, get = hooks.get, block = hooks.block;
          dom.detectNamespace(contextualElement);
          var fragment;
          if (env.useFragmentCache && dom.canClone) {
            if (this.cachedFragment === null) {
              fragment = this.build(dom);
              if (this.hasRendered) {
                this.cachedFragment = fragment;
              } else {
                this.hasRendered = true;
              }
            }
            if (this.cachedFragment) {
              fragment = dom.cloneNode(this.cachedFragment, true);
            }
          } else {
            fragment = this.build(dom);
          }
          var morph0 = dom.createMorphAt(fragment,0,0,contextualElement);
          dom.insertBoundary(fragment, null);
          dom.insertBoundary(fragment, 0);
          set(env, context, "version", blockArguments[0]);
          block(env, morph0, context, "if", [get(env, context, "version.shouldRender")], {}, child0, null);
          return fragment;
        }
      };
    }());
    return {
      isHTMLBars: true,
      revision: "Ember@1.11.1",
      blockParams: 0,
      cachedFragment: null,
      hasRendered: false,
      build: function build(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createComment("");
        dom.appendChild(el0, el1);
        return el0;
      },
      render: function render(context, env, contextualElement) {
        var dom = env.dom;
        var hooks = env.hooks, get = hooks.get, block = hooks.block;
        dom.detectNamespace(contextualElement);
        var fragment;
        if (env.useFragmentCache && dom.canClone) {
          if (this.cachedFragment === null) {
            fragment = this.build(dom);
            if (this.hasRendered) {
              this.cachedFragment = fragment;
            } else {
              this.hasRendered = true;
            }
          }
          if (this.cachedFragment) {
            fragment = dom.cloneNode(this.cachedFragment, true);
          }
        } else {
          fragment = this.build(dom);
        }
        var morph0 = dom.createMorphAt(fragment,0,0,contextualElement);
        dom.insertBoundary(fragment, null);
        dom.insertBoundary(fragment, 0);
        block(env, morph0, context, "each", [get(env, context, "versions")], {}, child0, null);
        return fragment;
      }
    };
  }()));

});
define('physical-design/templates/components/liquid-with', ['exports'], function (exports) {

  'use strict';

  exports['default'] = Ember.HTMLBars.template((function() {
    var child0 = (function() {
      var child0 = (function() {
        return {
          isHTMLBars: true,
          revision: "Ember@1.11.1",
          blockParams: 1,
          cachedFragment: null,
          hasRendered: false,
          build: function build(dom) {
            var el0 = dom.createDocumentFragment();
            var el1 = dom.createComment("");
            dom.appendChild(el0, el1);
            return el0;
          },
          render: function render(context, env, contextualElement, blockArguments) {
            var dom = env.dom;
            var hooks = env.hooks, set = hooks.set, get = hooks.get, inline = hooks.inline;
            dom.detectNamespace(contextualElement);
            var fragment;
            if (env.useFragmentCache && dom.canClone) {
              if (this.cachedFragment === null) {
                fragment = this.build(dom);
                if (this.hasRendered) {
                  this.cachedFragment = fragment;
                } else {
                  this.hasRendered = true;
                }
              }
              if (this.cachedFragment) {
                fragment = dom.cloneNode(this.cachedFragment, true);
              }
            } else {
              fragment = this.build(dom);
            }
            var morph0 = dom.createMorphAt(fragment,0,0,contextualElement);
            dom.insertBoundary(fragment, null);
            dom.insertBoundary(fragment, 0);
            set(env, context, "version", blockArguments[0]);
            inline(env, morph0, context, "yield", [get(env, context, "version")], {});
            return fragment;
          }
        };
      }());
      return {
        isHTMLBars: true,
        revision: "Ember@1.11.1",
        blockParams: 0,
        cachedFragment: null,
        hasRendered: false,
        build: function build(dom) {
          var el0 = dom.createDocumentFragment();
          var el1 = dom.createComment("");
          dom.appendChild(el0, el1);
          return el0;
        },
        render: function render(context, env, contextualElement) {
          var dom = env.dom;
          var hooks = env.hooks, get = hooks.get, block = hooks.block;
          dom.detectNamespace(contextualElement);
          var fragment;
          if (env.useFragmentCache && dom.canClone) {
            if (this.cachedFragment === null) {
              fragment = this.build(dom);
              if (this.hasRendered) {
                this.cachedFragment = fragment;
              } else {
                this.hasRendered = true;
              }
            }
            if (this.cachedFragment) {
              fragment = dom.cloneNode(this.cachedFragment, true);
            }
          } else {
            fragment = this.build(dom);
          }
          var morph0 = dom.createMorphAt(fragment,0,0,contextualElement);
          dom.insertBoundary(fragment, null);
          dom.insertBoundary(fragment, 0);
          block(env, morph0, context, "liquid-versions", [], {"value": get(env, context, "value"), "use": get(env, context, "use"), "name": get(env, context, "name"), "innerClass": get(env, context, "innerClass")}, child0, null);
          return fragment;
        }
      };
    }());
    var child1 = (function() {
      var child0 = (function() {
        var child0 = (function() {
          return {
            isHTMLBars: true,
            revision: "Ember@1.11.1",
            blockParams: 1,
            cachedFragment: null,
            hasRendered: false,
            build: function build(dom) {
              var el0 = dom.createDocumentFragment();
              var el1 = dom.createComment("");
              dom.appendChild(el0, el1);
              return el0;
            },
            render: function render(context, env, contextualElement, blockArguments) {
              var dom = env.dom;
              var hooks = env.hooks, set = hooks.set, get = hooks.get, inline = hooks.inline;
              dom.detectNamespace(contextualElement);
              var fragment;
              if (env.useFragmentCache && dom.canClone) {
                if (this.cachedFragment === null) {
                  fragment = this.build(dom);
                  if (this.hasRendered) {
                    this.cachedFragment = fragment;
                  } else {
                    this.hasRendered = true;
                  }
                }
                if (this.cachedFragment) {
                  fragment = dom.cloneNode(this.cachedFragment, true);
                }
              } else {
                fragment = this.build(dom);
              }
              var morph0 = dom.createMorphAt(fragment,0,0,contextualElement);
              dom.insertBoundary(fragment, null);
              dom.insertBoundary(fragment, 0);
              set(env, context, "version", blockArguments[0]);
              inline(env, morph0, context, "yield", [get(env, context, "version")], {});
              return fragment;
            }
          };
        }());
        return {
          isHTMLBars: true,
          revision: "Ember@1.11.1",
          blockParams: 1,
          cachedFragment: null,
          hasRendered: false,
          build: function build(dom) {
            var el0 = dom.createDocumentFragment();
            var el1 = dom.createComment("");
            dom.appendChild(el0, el1);
            return el0;
          },
          render: function render(context, env, contextualElement, blockArguments) {
            var dom = env.dom;
            var hooks = env.hooks, set = hooks.set, get = hooks.get, block = hooks.block;
            dom.detectNamespace(contextualElement);
            var fragment;
            if (env.useFragmentCache && dom.canClone) {
              if (this.cachedFragment === null) {
                fragment = this.build(dom);
                if (this.hasRendered) {
                  this.cachedFragment = fragment;
                } else {
                  this.hasRendered = true;
                }
              }
              if (this.cachedFragment) {
                fragment = dom.cloneNode(this.cachedFragment, true);
              }
            } else {
              fragment = this.build(dom);
            }
            var morph0 = dom.createMorphAt(fragment,0,0,contextualElement);
            dom.insertBoundary(fragment, null);
            dom.insertBoundary(fragment, 0);
            set(env, context, "container", blockArguments[0]);
            block(env, morph0, context, "liquid-versions", [], {"value": get(env, context, "value"), "notify": get(env, context, "container"), "use": get(env, context, "use"), "name": get(env, context, "name")}, child0, null);
            return fragment;
          }
        };
      }());
      return {
        isHTMLBars: true,
        revision: "Ember@1.11.1",
        blockParams: 0,
        cachedFragment: null,
        hasRendered: false,
        build: function build(dom) {
          var el0 = dom.createDocumentFragment();
          var el1 = dom.createComment("");
          dom.appendChild(el0, el1);
          return el0;
        },
        render: function render(context, env, contextualElement) {
          var dom = env.dom;
          var hooks = env.hooks, get = hooks.get, block = hooks.block;
          dom.detectNamespace(contextualElement);
          var fragment;
          if (env.useFragmentCache && dom.canClone) {
            if (this.cachedFragment === null) {
              fragment = this.build(dom);
              if (this.hasRendered) {
                this.cachedFragment = fragment;
              } else {
                this.hasRendered = true;
              }
            }
            if (this.cachedFragment) {
              fragment = dom.cloneNode(this.cachedFragment, true);
            }
          } else {
            fragment = this.build(dom);
          }
          var morph0 = dom.createMorphAt(fragment,0,0,contextualElement);
          dom.insertBoundary(fragment, null);
          dom.insertBoundary(fragment, 0);
          block(env, morph0, context, "liquid-container", [], {"id": get(env, context, "innerId"), "class": get(env, context, "innerClass")}, child0, null);
          return fragment;
        }
      };
    }());
    return {
      isHTMLBars: true,
      revision: "Ember@1.11.1",
      blockParams: 0,
      cachedFragment: null,
      hasRendered: false,
      build: function build(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createComment("");
        dom.appendChild(el0, el1);
        return el0;
      },
      render: function render(context, env, contextualElement) {
        var dom = env.dom;
        var hooks = env.hooks, get = hooks.get, block = hooks.block;
        dom.detectNamespace(contextualElement);
        var fragment;
        if (env.useFragmentCache && dom.canClone) {
          if (this.cachedFragment === null) {
            fragment = this.build(dom);
            if (this.hasRendered) {
              this.cachedFragment = fragment;
            } else {
              this.hasRendered = true;
            }
          }
          if (this.cachedFragment) {
            fragment = dom.cloneNode(this.cachedFragment, true);
          }
        } else {
          fragment = this.build(dom);
        }
        var morph0 = dom.createMorphAt(fragment,0,0,contextualElement);
        dom.insertBoundary(fragment, null);
        dom.insertBoundary(fragment, 0);
        block(env, morph0, context, "if", [get(env, context, "containerless")], {}, child0, child1);
        return fragment;
      }
    };
  }()));

});
define('physical-design/templates/components/speaker-details', ['exports'], function (exports) {

  'use strict';

  exports['default'] = Ember.HTMLBars.template((function() {
    var child0 = (function() {
      return {
        isHTMLBars: true,
        revision: "Ember@1.11.1",
        blockParams: 0,
        cachedFragment: null,
        hasRendered: false,
        build: function build(dom) {
          var el0 = dom.createDocumentFragment();
          var el1 = dom.createTextNode("    ");
          dom.appendChild(el0, el1);
          var el1 = dom.createComment("");
          dom.appendChild(el0, el1);
          var el1 = dom.createTextNode("\n    ");
          dom.appendChild(el0, el1);
          var el1 = dom.createComment("");
          dom.appendChild(el0, el1);
          var el1 = dom.createTextNode("\n    ");
          dom.appendChild(el0, el1);
          var el1 = dom.createElement("button");
          var el2 = dom.createTextNode("Save");
          dom.appendChild(el1, el2);
          dom.appendChild(el0, el1);
          var el1 = dom.createTextNode("\n    ");
          dom.appendChild(el0, el1);
          var el1 = dom.createElement("button");
          var el2 = dom.createTextNode("Cancel");
          dom.appendChild(el1, el2);
          dom.appendChild(el0, el1);
          var el1 = dom.createTextNode("    \n");
          dom.appendChild(el0, el1);
          return el0;
        },
        render: function render(context, env, contextualElement) {
          var dom = env.dom;
          var hooks = env.hooks, get = hooks.get, inline = hooks.inline, element = hooks.element;
          dom.detectNamespace(contextualElement);
          var fragment;
          if (env.useFragmentCache && dom.canClone) {
            if (this.cachedFragment === null) {
              fragment = this.build(dom);
              if (this.hasRendered) {
                this.cachedFragment = fragment;
              } else {
                this.hasRendered = true;
              }
            }
            if (this.cachedFragment) {
              fragment = dom.cloneNode(this.cachedFragment, true);
            }
          } else {
            fragment = this.build(dom);
          }
          var element1 = dom.childAt(fragment, [5]);
          var element2 = dom.childAt(fragment, [7]);
          var morph0 = dom.createMorphAt(fragment,1,1,contextualElement);
          var morph1 = dom.createMorphAt(fragment,3,3,contextualElement);
          inline(env, morph0, context, "input", [], {"value": get(env, context, "editorName")});
          inline(env, morph1, context, "textarea", [], {"rows": 3, "value": get(env, context, "editorBio")});
          element(env, element1, context, "action", ["save"], {});
          element(env, element2, context, "action", ["cancel"], {});
          return fragment;
        }
      };
    }());
    var child1 = (function() {
      return {
        isHTMLBars: true,
        revision: "Ember@1.11.1",
        blockParams: 0,
        cachedFragment: null,
        hasRendered: false,
        build: function build(dom) {
          var el0 = dom.createDocumentFragment();
          var el1 = dom.createTextNode("    ");
          dom.appendChild(el0, el1);
          var el1 = dom.createElement("div");
          dom.setAttribute(el1,"class","top");
          var el2 = dom.createTextNode("\n      ");
          dom.appendChild(el1, el2);
          var el2 = dom.createElement("h3");
          var el3 = dom.createComment("");
          dom.appendChild(el2, el3);
          dom.appendChild(el1, el2);
          var el2 = dom.createTextNode("\n      ");
          dom.appendChild(el1, el2);
          var el2 = dom.createElement("p");
          var el3 = dom.createComment("");
          dom.appendChild(el2, el3);
          dom.appendChild(el1, el2);
          var el2 = dom.createTextNode("\n    ");
          dom.appendChild(el1, el2);
          dom.appendChild(el0, el1);
          var el1 = dom.createTextNode("\n");
          dom.appendChild(el0, el1);
          return el0;
        },
        render: function render(context, env, contextualElement) {
          var dom = env.dom;
          var hooks = env.hooks, element = hooks.element, content = hooks.content, get = hooks.get, inline = hooks.inline;
          dom.detectNamespace(contextualElement);
          var fragment;
          if (env.useFragmentCache && dom.canClone) {
            if (this.cachedFragment === null) {
              fragment = this.build(dom);
              if (this.hasRendered) {
                this.cachedFragment = fragment;
              } else {
                this.hasRendered = true;
              }
            }
            if (this.cachedFragment) {
              fragment = dom.cloneNode(this.cachedFragment, true);
            }
          } else {
            fragment = this.build(dom);
          }
          var element0 = dom.childAt(fragment, [1]);
          var morph0 = dom.createMorphAt(dom.childAt(element0, [1]),0,0);
          var morph1 = dom.createMorphAt(dom.childAt(element0, [3]),0,0);
          element(env, element0, context, "action", ["edit"], {});
          content(env, morph0, context, "model.name");
          inline(env, morph1, context, "with-br", [get(env, context, "model.bio")], {});
          return fragment;
        }
      };
    }());
    return {
      isHTMLBars: true,
      revision: "Ember@1.11.1",
      blockParams: 0,
      cachedFragment: null,
      hasRendered: false,
      build: function build(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createComment("");
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n\n");
        dom.appendChild(el0, el1);
        var el1 = dom.createElement("div");
        dom.setAttribute(el1,"class","speakers-description description-header");
        var el2 = dom.createTextNode("\n");
        dom.appendChild(el1, el2);
        var el2 = dom.createComment("");
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("  ");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("div");
        dom.setAttribute(el2,"class","bottom");
        var el3 = dom.createTextNode("\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("h4");
        var el4 = dom.createElement("span");
        var el5 = dom.createTextNode("Session:");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode(" ");
        dom.appendChild(el3, el4);
        var el4 = dom.createComment("");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n  ");
        dom.appendChild(el2, el3);
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n");
        dom.appendChild(el1, el2);
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n");
        dom.appendChild(el0, el1);
        return el0;
      },
      render: function render(context, env, contextualElement) {
        var dom = env.dom;
        var hooks = env.hooks, get = hooks.get, inline = hooks.inline, block = hooks.block, content = hooks.content;
        dom.detectNamespace(contextualElement);
        var fragment;
        if (env.useFragmentCache && dom.canClone) {
          if (this.cachedFragment === null) {
            fragment = this.build(dom);
            if (this.hasRendered) {
              this.cachedFragment = fragment;
            } else {
              this.hasRendered = true;
            }
          }
          if (this.cachedFragment) {
            fragment = dom.cloneNode(this.cachedFragment, true);
          }
        } else {
          fragment = this.build(dom);
        }
        var element3 = dom.childAt(fragment, [2]);
        var morph0 = dom.createMorphAt(fragment,0,0,contextualElement);
        var morph1 = dom.createMorphAt(element3,1,1);
        var morph2 = dom.createMorphAt(dom.childAt(element3, [3, 1]),2,2);
        dom.insertBoundary(fragment, 0);
        inline(env, morph0, context, "speaker-image", [], {"speaker": get(env, context, "model")});
        block(env, morph1, context, "liquid-if", [get(env, context, "editing")], {}, child0, child1);
        content(env, morph2, context, "model.session");
        return fragment;
      }
    };
  }()));

});
define('physical-design/templates/components/speaker-image', ['exports'], function (exports) {

  'use strict';

  exports['default'] = Ember.HTMLBars.template((function() {
    return {
      isHTMLBars: true,
      revision: "Ember@1.11.1",
      blockParams: 0,
      cachedFragment: null,
      hasRendered: false,
      build: function build(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createElement("div");
        dom.setAttribute(el1,"class","speakers-image");
        var el2 = dom.createTextNode("\n  ");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("img");
        dom.setAttribute(el2,"class","speaker-image-large");
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n  ");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("h6");
        var el3 = dom.createTextNode("\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("span");
        dom.setAttribute(el3,"class","fontawesome-twitter");
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("a");
        var el4 = dom.createComment("");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n  ");
        dom.appendChild(el2, el3);
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n");
        dom.appendChild(el1, el2);
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n");
        dom.appendChild(el0, el1);
        return el0;
      },
      render: function render(context, env, contextualElement) {
        var dom = env.dom;
        var hooks = env.hooks, get = hooks.get, concat = hooks.concat, attribute = hooks.attribute, content = hooks.content;
        dom.detectNamespace(contextualElement);
        var fragment;
        if (env.useFragmentCache && dom.canClone) {
          if (this.cachedFragment === null) {
            fragment = this.build(dom);
            if (this.hasRendered) {
              this.cachedFragment = fragment;
            } else {
              this.hasRendered = true;
            }
          }
          if (this.cachedFragment) {
            fragment = dom.cloneNode(this.cachedFragment, true);
          }
        } else {
          fragment = this.build(dom);
        }
        var element0 = dom.childAt(fragment, [0]);
        var element1 = dom.childAt(element0, [1]);
        var element2 = dom.childAt(element0, [3, 3]);
        var attrMorph0 = dom.createAttrMorph(element0, 'id');
        var attrMorph1 = dom.createAttrMorph(element1, 'alt');
        var attrMorph2 = dom.createAttrMorph(element1, 'src');
        var attrMorph3 = dom.createAttrMorph(element1, 'data-speaker-id');
        var morph0 = dom.createMorphAt(element2,0,0);
        var attrMorph4 = dom.createAttrMorph(element2, 'href');
        attribute(env, attrMorph0, element0, "id", concat(env, [get(env, context, "speaker.id")]));
        attribute(env, attrMorph1, element1, "alt", concat(env, [get(env, context, "speaker.name")]));
        attribute(env, attrMorph2, element1, "src", concat(env, [get(env, context, "speaker.imageURL")]));
        attribute(env, attrMorph3, element1, "data-speaker-id", get(env, context, "speaker.id"));
        attribute(env, attrMorph4, element2, "href", concat(env, [get(env, context, "speaker.twitterURL")]));
        content(env, morph0, context, "speaker.twitterHandle");
        return fragment;
      }
    };
  }()));

});
define('physical-design/templates/components/sponsor-detail', ['exports'], function (exports) {

  'use strict';

  exports['default'] = Ember.HTMLBars.template((function() {
    return {
      isHTMLBars: true,
      revision: "Ember@1.11.1",
      blockParams: 0,
      cachedFragment: null,
      hasRendered: false,
      build: function build(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createElement("div");
        var el2 = dom.createTextNode("I'm sponsor detail yay");
        dom.appendChild(el1, el2);
        dom.appendChild(el0, el1);
        return el0;
      },
      render: function render(context, env, contextualElement) {
        var dom = env.dom;
        var hooks = env.hooks, get = hooks.get, attribute = hooks.attribute;
        dom.detectNamespace(contextualElement);
        var fragment;
        if (env.useFragmentCache && dom.canClone) {
          if (this.cachedFragment === null) {
            fragment = this.build(dom);
            if (this.hasRendered) {
              this.cachedFragment = fragment;
            } else {
              this.hasRendered = true;
            }
          }
          if (this.cachedFragment) {
            fragment = dom.cloneNode(this.cachedFragment, true);
          }
        } else {
          fragment = this.build(dom);
        }
        var element0 = dom.childAt(fragment, [0]);
        var attrMorph0 = dom.createAttrMorph(element0, 'data-sponsor-id');
        attribute(env, attrMorph0, element0, "data-sponsor-id", get(env, context, "model.id"));
        return fragment;
      }
    };
  }()));

});
define('physical-design/templates/emberconf', ['exports'], function (exports) {

  'use strict';

  exports['default'] = Ember.HTMLBars.template((function() {
    return {
      isHTMLBars: true,
      revision: "Ember@1.11.1",
      blockParams: 0,
      cachedFragment: null,
      hasRendered: false,
      build: function build(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createElement("div");
        dom.setAttribute(el1,"id","emberconf");
        var el2 = dom.createTextNode("\n  ");
        dom.appendChild(el1, el2);
        var el2 = dom.createComment("");
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n  ");
        dom.appendChild(el1, el2);
        var el2 = dom.createComment("");
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n  ");
        dom.appendChild(el1, el2);
        var el2 = dom.createComment("");
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n");
        dom.appendChild(el1, el2);
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n");
        dom.appendChild(el0, el1);
        return el0;
      },
      render: function render(context, env, contextualElement) {
        var dom = env.dom;
        var hooks = env.hooks, content = hooks.content;
        dom.detectNamespace(contextualElement);
        var fragment;
        if (env.useFragmentCache && dom.canClone) {
          if (this.cachedFragment === null) {
            fragment = this.build(dom);
            if (this.hasRendered) {
              this.cachedFragment = fragment;
            } else {
              this.hasRendered = true;
            }
          }
          if (this.cachedFragment) {
            fragment = dom.cloneNode(this.cachedFragment, true);
          }
        } else {
          fragment = this.build(dom);
        }
        var element0 = dom.childAt(fragment, [0]);
        var morph0 = dom.createMorphAt(element0,1,1);
        var morph1 = dom.createMorphAt(element0,3,3);
        var morph2 = dom.createMorphAt(element0,5,5);
        content(env, morph0, context, "emberconf-header");
        content(env, morph1, context, "liquid-outlet");
        content(env, morph2, context, "emberconf-footer");
        return fragment;
      }
    };
  }()));

});
define('physical-design/templates/emberconf/speaker', ['exports'], function (exports) {

  'use strict';

  exports['default'] = Ember.HTMLBars.template((function() {
    return {
      isHTMLBars: true,
      revision: "Ember@1.11.1",
      blockParams: 0,
      cachedFragment: null,
      hasRendered: false,
      build: function build(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createComment("");
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n\n");
        dom.appendChild(el0, el1);
        var el1 = dom.createComment("");
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n");
        dom.appendChild(el0, el1);
        return el0;
      },
      render: function render(context, env, contextualElement) {
        var dom = env.dom;
        var hooks = env.hooks, inline = hooks.inline, get = hooks.get;
        dom.detectNamespace(contextualElement);
        var fragment;
        if (env.useFragmentCache && dom.canClone) {
          if (this.cachedFragment === null) {
            fragment = this.build(dom);
            if (this.hasRendered) {
              this.cachedFragment = fragment;
            } else {
              this.hasRendered = true;
            }
          }
          if (this.cachedFragment) {
            fragment = dom.cloneNode(this.cachedFragment, true);
          }
        } else {
          fragment = this.build(dom);
        }
        var morph0 = dom.createMorphAt(fragment,0,0,contextualElement);
        var morph1 = dom.createMorphAt(fragment,2,2,contextualElement);
        dom.insertBoundary(fragment, 0);
        inline(env, morph0, context, "link-to", ["Speakers", "emberconf.speakers"], {"tagName": "button", "class": "speakers-btn"});
        inline(env, morph1, context, "speaker-details", [], {"model": get(env, context, "model")});
        return fragment;
      }
    };
  }()));

});
define('physical-design/templates/emberconf/speakers', ['exports'], function (exports) {

  'use strict';

  exports['default'] = Ember.HTMLBars.template((function() {
    var child0 = (function() {
      var child0 = (function() {
        var child0 = (function() {
          return {
            isHTMLBars: true,
            revision: "Ember@1.11.1",
            blockParams: 0,
            cachedFragment: null,
            hasRendered: false,
            build: function build(dom) {
              var el0 = dom.createDocumentFragment();
              var el1 = dom.createTextNode("        ");
              dom.appendChild(el0, el1);
              var el1 = dom.createElement("img");
              dom.setAttribute(el1,"class","speaker-image-small");
              dom.appendChild(el0, el1);
              var el1 = dom.createTextNode("\n");
              dom.appendChild(el0, el1);
              return el0;
            },
            render: function render(context, env, contextualElement) {
              var dom = env.dom;
              var hooks = env.hooks, get = hooks.get, concat = hooks.concat, attribute = hooks.attribute;
              dom.detectNamespace(contextualElement);
              var fragment;
              if (env.useFragmentCache && dom.canClone) {
                if (this.cachedFragment === null) {
                  fragment = this.build(dom);
                  if (this.hasRendered) {
                    this.cachedFragment = fragment;
                  } else {
                    this.hasRendered = true;
                  }
                }
                if (this.cachedFragment) {
                  fragment = dom.cloneNode(this.cachedFragment, true);
                }
              } else {
                fragment = this.build(dom);
              }
              var element0 = dom.childAt(fragment, [1]);
              var attrMorph0 = dom.createAttrMorph(element0, 'alt');
              var attrMorph1 = dom.createAttrMorph(element0, 'src');
              var attrMorph2 = dom.createAttrMorph(element0, 'data-speaker-id');
              attribute(env, attrMorph0, element0, "alt", concat(env, [get(env, context, "speaker.name")]));
              attribute(env, attrMorph1, element0, "src", concat(env, [get(env, context, "speaker.imageURL")]));
              attribute(env, attrMorph2, element0, "data-speaker-id", get(env, context, "speaker.id"));
              return fragment;
            }
          };
        }());
        return {
          isHTMLBars: true,
          revision: "Ember@1.11.1",
          blockParams: 1,
          cachedFragment: null,
          hasRendered: false,
          build: function build(dom) {
            var el0 = dom.createDocumentFragment();
            var el1 = dom.createComment("");
            dom.appendChild(el0, el1);
            return el0;
          },
          render: function render(context, env, contextualElement, blockArguments) {
            var dom = env.dom;
            var hooks = env.hooks, set = hooks.set, get = hooks.get, block = hooks.block;
            dom.detectNamespace(contextualElement);
            var fragment;
            if (env.useFragmentCache && dom.canClone) {
              if (this.cachedFragment === null) {
                fragment = this.build(dom);
                if (this.hasRendered) {
                  this.cachedFragment = fragment;
                } else {
                  this.hasRendered = true;
                }
              }
              if (this.cachedFragment) {
                fragment = dom.cloneNode(this.cachedFragment, true);
              }
            } else {
              fragment = this.build(dom);
            }
            var morph0 = dom.createMorphAt(fragment,0,0,contextualElement);
            dom.insertBoundary(fragment, null);
            dom.insertBoundary(fragment, 0);
            set(env, context, "speaker", blockArguments[0]);
            block(env, morph0, context, "link-to", ["emberconf.speaker", get(env, context, "speaker")], {}, child0, null);
            return fragment;
          }
        };
      }());
      return {
        isHTMLBars: true,
        revision: "Ember@1.11.1",
        blockParams: 1,
        cachedFragment: null,
        hasRendered: false,
        build: function build(dom) {
          var el0 = dom.createDocumentFragment();
          var el1 = dom.createComment("");
          dom.appendChild(el0, el1);
          return el0;
        },
        render: function render(context, env, contextualElement, blockArguments) {
          var dom = env.dom;
          var hooks = env.hooks, set = hooks.set, get = hooks.get, block = hooks.block;
          dom.detectNamespace(contextualElement);
          var fragment;
          if (env.useFragmentCache && dom.canClone) {
            if (this.cachedFragment === null) {
              fragment = this.build(dom);
              if (this.hasRendered) {
                this.cachedFragment = fragment;
              } else {
                this.hasRendered = true;
              }
            }
            if (this.cachedFragment) {
              fragment = dom.cloneNode(this.cachedFragment, true);
            }
          } else {
            fragment = this.build(dom);
          }
          var morph0 = dom.createMorphAt(fragment,0,0,contextualElement);
          dom.insertBoundary(fragment, null);
          dom.insertBoundary(fragment, 0);
          set(env, context, "currentModel", blockArguments[0]);
          block(env, morph0, context, "each", [get(env, context, "currentModel")], {}, child0, null);
          return fragment;
        }
      };
    }());
    return {
      isHTMLBars: true,
      revision: "Ember@1.11.1",
      blockParams: 0,
      cachedFragment: null,
      hasRendered: false,
      build: function build(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createElement("button");
        dom.setAttribute(el1,"class","shuffle");
        var el2 = dom.createTextNode("Shuffle");
        dom.appendChild(el1, el2);
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n\n");
        dom.appendChild(el0, el1);
        var el1 = dom.createElement("div");
        dom.setAttribute(el1,"class","speaker-icons");
        var el2 = dom.createTextNode("\n");
        dom.appendChild(el1, el2);
        var el2 = dom.createComment("");
        dom.appendChild(el1, el2);
        dom.appendChild(el0, el1);
        return el0;
      },
      render: function render(context, env, contextualElement) {
        var dom = env.dom;
        var hooks = env.hooks, element = hooks.element, get = hooks.get, block = hooks.block;
        dom.detectNamespace(contextualElement);
        var fragment;
        if (env.useFragmentCache && dom.canClone) {
          if (this.cachedFragment === null) {
            fragment = this.build(dom);
            if (this.hasRendered) {
              this.cachedFragment = fragment;
            } else {
              this.hasRendered = true;
            }
          }
          if (this.cachedFragment) {
            fragment = dom.cloneNode(this.cachedFragment, true);
          }
        } else {
          fragment = this.build(dom);
        }
        var element1 = dom.childAt(fragment, [0]);
        var morph0 = dom.createMorphAt(dom.childAt(fragment, [2]),1,1);
        element(env, element1, context, "action", ["shuffle"], {});
        block(env, morph0, context, "liquid-with", [get(env, context, "model")], {}, child0, null);
        return fragment;
      }
    };
  }()));

});
define('physical-design/templates/sponsors', ['exports'], function (exports) {

  'use strict';

  exports['default'] = Ember.HTMLBars.template((function() {
    var child0 = (function() {
      var child0 = (function() {
        var child0 = (function() {
          return {
            isHTMLBars: true,
            revision: "Ember@1.11.1",
            blockParams: 0,
            cachedFragment: null,
            hasRendered: false,
            build: function build(dom) {
              var el0 = dom.createDocumentFragment();
              var el1 = dom.createTextNode("        ");
              dom.appendChild(el0, el1);
              var el1 = dom.createElement("div");
              dom.setAttribute(el1,"class","sponsor-logo");
              var el2 = dom.createTextNode("\n          ");
              dom.appendChild(el1, el2);
              var el2 = dom.createElement("img");
              dom.appendChild(el1, el2);
              var el2 = dom.createTextNode("\n        ");
              dom.appendChild(el1, el2);
              dom.appendChild(el0, el1);
              var el1 = dom.createTextNode("\n");
              dom.appendChild(el0, el1);
              return el0;
            },
            render: function render(context, env, contextualElement) {
              var dom = env.dom;
              var hooks = env.hooks, get = hooks.get, attribute = hooks.attribute;
              dom.detectNamespace(contextualElement);
              var fragment;
              if (env.useFragmentCache && dom.canClone) {
                if (this.cachedFragment === null) {
                  fragment = this.build(dom);
                  if (this.hasRendered) {
                    this.cachedFragment = fragment;
                  } else {
                    this.hasRendered = true;
                  }
                }
                if (this.cachedFragment) {
                  fragment = dom.cloneNode(this.cachedFragment, true);
                }
              } else {
                fragment = this.build(dom);
              }
              var element0 = dom.childAt(fragment, [1, 1]);
              var attrMorph0 = dom.createAttrMorph(element0, 'src');
              attribute(env, attrMorph0, element0, "src", get(env, context, "sponsor.imageURL"));
              return fragment;
            }
          };
        }());
        var child1 = (function() {
          return {
            isHTMLBars: true,
            revision: "Ember@1.11.1",
            blockParams: 0,
            cachedFragment: null,
            hasRendered: false,
            build: function build(dom) {
              var el0 = dom.createDocumentFragment();
              var el1 = dom.createTextNode("        ");
              dom.appendChild(el0, el1);
              var el1 = dom.createComment("");
              dom.appendChild(el0, el1);
              var el1 = dom.createTextNode("\n");
              dom.appendChild(el0, el1);
              return el0;
            },
            render: function render(context, env, contextualElement) {
              var dom = env.dom;
              var hooks = env.hooks, content = hooks.content;
              dom.detectNamespace(contextualElement);
              var fragment;
              if (env.useFragmentCache && dom.canClone) {
                if (this.cachedFragment === null) {
                  fragment = this.build(dom);
                  if (this.hasRendered) {
                    this.cachedFragment = fragment;
                  } else {
                    this.hasRendered = true;
                  }
                }
                if (this.cachedFragment) {
                  fragment = dom.cloneNode(this.cachedFragment, true);
                }
              } else {
                fragment = this.build(dom);
              }
              var morph0 = dom.createMorphAt(fragment,1,1,contextualElement);
              content(env, morph0, context, "outlet");
              return fragment;
            }
          };
        }());
        return {
          isHTMLBars: true,
          revision: "Ember@1.11.1",
          blockParams: 1,
          cachedFragment: null,
          hasRendered: false,
          build: function build(dom) {
            var el0 = dom.createDocumentFragment();
            var el1 = dom.createTextNode("    ");
            dom.appendChild(el0, el1);
            var el1 = dom.createElement("div");
            dom.setAttribute(el1,"class","sponsor-card");
            var el2 = dom.createTextNode("\n");
            dom.appendChild(el1, el2);
            var el2 = dom.createComment("");
            dom.appendChild(el1, el2);
            var el2 = dom.createComment("");
            dom.appendChild(el1, el2);
            var el2 = dom.createTextNode("    ");
            dom.appendChild(el1, el2);
            dom.appendChild(el0, el1);
            var el1 = dom.createTextNode("\n");
            dom.appendChild(el0, el1);
            return el0;
          },
          render: function render(context, env, contextualElement, blockArguments) {
            var dom = env.dom;
            var hooks = env.hooks, set = hooks.set, get = hooks.get, attribute = hooks.attribute, block = hooks.block;
            dom.detectNamespace(contextualElement);
            var fragment;
            if (env.useFragmentCache && dom.canClone) {
              if (this.cachedFragment === null) {
                fragment = this.build(dom);
                if (this.hasRendered) {
                  this.cachedFragment = fragment;
                } else {
                  this.hasRendered = true;
                }
              }
              if (this.cachedFragment) {
                fragment = dom.cloneNode(this.cachedFragment, true);
              }
            } else {
              fragment = this.build(dom);
            }
            var element1 = dom.childAt(fragment, [1]);
            var morph0 = dom.createMorphAt(element1,1,1);
            var morph1 = dom.createMorphAt(element1,2,2);
            var attrMorph0 = dom.createAttrMorph(element1, 'data-sponsor-id');
            set(env, context, "sponsor", blockArguments[0]);
            attribute(env, attrMorph0, element1, "data-sponsor-id", get(env, context, "sponsor.id"));
            block(env, morph0, context, "link-to", ["sponsors.sponsor", get(env, context, "sponsor.id")], {}, child0, null);
            block(env, morph1, context, "if", [get(env, context, "sponsor.isActive")], {}, child1, null);
            return fragment;
          }
        };
      }());
      return {
        isHTMLBars: true,
        revision: "Ember@1.11.1",
        blockParams: 1,
        cachedFragment: null,
        hasRendered: false,
        build: function build(dom) {
          var el0 = dom.createDocumentFragment();
          var el1 = dom.createComment("");
          dom.appendChild(el0, el1);
          return el0;
        },
        render: function render(context, env, contextualElement, blockArguments) {
          var dom = env.dom;
          var hooks = env.hooks, set = hooks.set, get = hooks.get, block = hooks.block;
          dom.detectNamespace(contextualElement);
          var fragment;
          if (env.useFragmentCache && dom.canClone) {
            if (this.cachedFragment === null) {
              fragment = this.build(dom);
              if (this.hasRendered) {
                this.cachedFragment = fragment;
              } else {
                this.hasRendered = true;
              }
            }
            if (this.cachedFragment) {
              fragment = dom.cloneNode(this.cachedFragment, true);
            }
          } else {
            fragment = this.build(dom);
          }
          var morph0 = dom.createMorphAt(fragment,0,0,contextualElement);
          dom.insertBoundary(fragment, null);
          dom.insertBoundary(fragment, 0);
          set(env, context, "sponsors", blockArguments[0]);
          block(env, morph0, context, "each", [get(env, context, "sponsors")], {}, child0, null);
          return fragment;
        }
      };
    }());
    return {
      isHTMLBars: true,
      revision: "Ember@1.11.1",
      blockParams: 0,
      cachedFragment: null,
      hasRendered: false,
      build: function build(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createElement("div");
        dom.setAttribute(el1,"class","xsponsors-footer");
        var el2 = dom.createTextNode("\n  ");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("h3");
        var el3 = dom.createTextNode("Sponsors");
        dom.appendChild(el2, el3);
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n");
        dom.appendChild(el1, el2);
        var el2 = dom.createComment("");
        dom.appendChild(el1, el2);
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n\n");
        dom.appendChild(el0, el1);
        return el0;
      },
      render: function render(context, env, contextualElement) {
        var dom = env.dom;
        var hooks = env.hooks, get = hooks.get, block = hooks.block;
        dom.detectNamespace(contextualElement);
        var fragment;
        if (env.useFragmentCache && dom.canClone) {
          if (this.cachedFragment === null) {
            fragment = this.build(dom);
            if (this.hasRendered) {
              this.cachedFragment = fragment;
            } else {
              this.hasRendered = true;
            }
          }
          if (this.cachedFragment) {
            fragment = dom.cloneNode(this.cachedFragment, true);
          }
        } else {
          fragment = this.build(dom);
        }
        var morph0 = dom.createMorphAt(dom.childAt(fragment, [0]),3,3);
        block(env, morph0, context, "liquid-with", [get(env, context, "model")], {}, child0, null);
        return fragment;
      }
    };
  }()));

});
define('physical-design/templates/sponsors/sponsor', ['exports'], function (exports) {

  'use strict';

  exports['default'] = Ember.HTMLBars.template((function() {
    return {
      isHTMLBars: true,
      revision: "Ember@1.11.1",
      blockParams: 0,
      cachedFragment: null,
      hasRendered: false,
      build: function build(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createComment("");
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n\n\n\n\n");
        dom.appendChild(el0, el1);
        return el0;
      },
      render: function render(context, env, contextualElement) {
        var dom = env.dom;
        var hooks = env.hooks, content = hooks.content;
        dom.detectNamespace(contextualElement);
        var fragment;
        if (env.useFragmentCache && dom.canClone) {
          if (this.cachedFragment === null) {
            fragment = this.build(dom);
            if (this.hasRendered) {
              this.cachedFragment = fragment;
            } else {
              this.hasRendered = true;
            }
          }
          if (this.cachedFragment) {
            fragment = dom.cloneNode(this.cachedFragment, true);
          }
        } else {
          fragment = this.build(dom);
        }
        var morph0 = dom.createUnsafeMorphAt(fragment,0,0,contextualElement);
        dom.insertBoundary(fragment, 0);
        content(env, morph0, context, "sponsor.description");
        return fragment;
      }
    };
  }()));

});
define('physical-design/tests/app.jshint', function () {

  'use strict';

  module('JSHint - .');
  test('app.js should pass jshint', function() { 
    ok(true, 'app.js should pass jshint.'); 
  });

});
define('physical-design/tests/components/speaker-details.jshint', function () {

  'use strict';

  module('JSHint - components');
  test('components/speaker-details.js should pass jshint', function() { 
    ok(true, 'components/speaker-details.js should pass jshint.'); 
  });

});
define('physical-design/tests/controllers/emberconf/speakers.jshint', function () {

  'use strict';

  module('JSHint - controllers/emberconf');
  test('controllers/emberconf/speakers.js should pass jshint', function() { 
    ok(true, 'controllers/emberconf/speakers.js should pass jshint.'); 
  });

});
define('physical-design/tests/controllers/emberconf/sponsors.jshint', function () {

  'use strict';

  module('JSHint - controllers/emberconf');
  test('controllers/emberconf/sponsors.js should pass jshint', function() { 
    ok(true, 'controllers/emberconf/sponsors.js should pass jshint.'); 
  });

});
define('physical-design/tests/helpers/resolver', ['exports', 'ember/resolver', 'physical-design/config/environment'], function (exports, Resolver, config) {

  'use strict';

  var resolver = Resolver['default'].create();

  resolver.namespace = {
    modulePrefix: config['default'].modulePrefix,
    podModulePrefix: config['default'].podModulePrefix
  };

  exports['default'] = resolver;

});
define('physical-design/tests/helpers/resolver.jshint', function () {

  'use strict';

  module('JSHint - helpers');
  test('helpers/resolver.js should pass jshint', function() { 
    ok(true, 'helpers/resolver.js should pass jshint.'); 
  });

});
define('physical-design/tests/helpers/start-app', ['exports', 'ember', 'physical-design/app', 'physical-design/router', 'physical-design/config/environment'], function (exports, Ember, Application, Router, config) {

  'use strict';



  exports['default'] = startApp;
  function startApp(attrs) {
    var application;

    var attributes = Ember['default'].merge({}, config['default'].APP);
    attributes = Ember['default'].merge(attributes, attrs); // use defaults, but you can override;

    Ember['default'].run(function () {
      application = Application['default'].create(attributes);
      application.setupForTesting();
      application.injectTestHelpers();
    });

    return application;
  }

});
define('physical-design/tests/helpers/start-app.jshint', function () {

  'use strict';

  module('JSHint - helpers');
  test('helpers/start-app.js should pass jshint', function() { 
    ok(true, 'helpers/start-app.js should pass jshint.'); 
  });

});
define('physical-design/tests/helpers/with-br.jshint', function () {

  'use strict';

  module('JSHint - helpers');
  test('helpers/with-br.js should pass jshint', function() { 
    ok(true, 'helpers/with-br.js should pass jshint.'); 
  });

});
define('physical-design/tests/router.jshint', function () {

  'use strict';

  module('JSHint - .');
  test('router.js should pass jshint', function() { 
    ok(true, 'router.js should pass jshint.'); 
  });

});
define('physical-design/tests/routes/emberconf/speaker.jshint', function () {

  'use strict';

  module('JSHint - routes/emberconf');
  test('routes/emberconf/speaker.js should pass jshint', function() { 
    ok(true, 'routes/emberconf/speaker.js should pass jshint.'); 
  });

});
define('physical-design/tests/routes/emberconf/speakers.jshint', function () {

  'use strict';

  module('JSHint - routes/emberconf');
  test('routes/emberconf/speakers.js should pass jshint', function() { 
    ok(true, 'routes/emberconf/speakers.js should pass jshint.'); 
  });

});
define('physical-design/tests/routes/emberconf/sponsors.jshint', function () {

  'use strict';

  module('JSHint - routes/emberconf');
  test('routes/emberconf/sponsors.js should pass jshint', function() { 
    ok(false, 'routes/emberconf/sponsors.js should pass jshint.\nroutes/emberconf/sponsors.js: line 92, col 219, This character may get silently deleted by one or more browsers.\n\n1 error'); 
  });

});
define('physical-design/tests/routes/emberconf/sponsors/sponsor.jshint', function () {

  'use strict';

  module('JSHint - routes/emberconf/sponsors');
  test('routes/emberconf/sponsors/sponsor.js should pass jshint', function() { 
    ok(true, 'routes/emberconf/sponsors/sponsor.js should pass jshint.'); 
  });

});
define('physical-design/tests/test-helper', ['physical-design/tests/helpers/resolver', 'ember-qunit'], function (resolver, ember_qunit) {

	'use strict';

	ember_qunit.setResolver(resolver['default']);

});
define('physical-design/tests/test-helper.jshint', function () {

  'use strict';

  module('JSHint - .');
  test('test-helper.js should pass jshint', function() { 
    ok(true, 'test-helper.js should pass jshint.'); 
  });

});
define('physical-design/tests/transitions.jshint', function () {

  'use strict';

  module('JSHint - .');
  test('transitions.js should pass jshint', function() { 
    ok(true, 'transitions.js should pass jshint.'); 
  });

});
define('physical-design/tests/transitions/simple-fade.jshint', function () {

  'use strict';

  module('JSHint - transitions');
  test('transitions/simple-fade.js should pass jshint', function() { 
    ok(true, 'transitions/simple-fade.js should pass jshint.'); 
  });

});
define('physical-design/tests/transitions/web-fly-to.jshint', function () {

  'use strict';

  module('JSHint - transitions');
  test('transitions/web-fly-to.js should pass jshint', function() { 
    ok(true, 'transitions/web-fly-to.js should pass jshint.'); 
  });

});
define('physical-design/transitions', ['exports'], function (exports) {

  'use strict';

  exports['default'] = function () {

    var duration = 500;

    this.transition(this.fromRoute('emberconf.speakers'), this.toRoute('emberconf.speaker'), this.use('explode', {
      matchBy: 'data-speaker-id',
      use: ['flyTo', { duration: duration }]
    }, {
      use: ['toLeft', { duration: duration }]
    }), this.reverse('explode', {
      matchBy: 'data-speaker-id',
      use: ['flyTo', { duration: duration }]
    }, {
      use: ['toRight', { duration: duration }]
    }));

    this.transition(this.childOf('.speaker-icons'), this.use('explode', {
      matchBy: 'data-speaker-id',
      use: ['flyTo', { duration: duration, easing: [250, 15] }]
    }));

    this.transition(this.inHelper('liquid-if'), this.toModel(true), this.use('toUp'), this.reverse('toDown'));
  }

});
define('physical-design/transitions/cross-fade', ['exports', 'liquid-fire'], function (exports, liquid_fire) {

  'use strict';


  exports['default'] = crossFade;
  // BEGIN-SNIPPET cross-fade-definition
  function crossFade() {
    var opts = arguments[0] === undefined ? {} : arguments[0];

    liquid_fire.stop(this.oldElement);
    return liquid_fire.Promise.all([liquid_fire.animate(this.oldElement, { opacity: 0 }, opts), liquid_fire.animate(this.newElement, { opacity: [opts.maxOpacity || 1, 0] }, opts)]);
  } // END-SNIPPET

});
define('physical-design/transitions/default', ['exports', 'liquid-fire'], function (exports, liquid_fire) {

  'use strict';



  // This is what we run when no animation is asked for. It just sets
  // the newly-added element to visible (because we always start them
  // out invisible so that transitions can control their initial
  // appearance).
  exports['default'] = defaultTransition;
  function defaultTransition() {
    if (this.newElement) {
      this.newElement.css({ visibility: "" });
    }
    return liquid_fire.Promise.resolve();
  }

});
define('physical-design/transitions/explode', ['exports', 'ember', 'liquid-fire'], function (exports, Ember, liquid_fire) {

  'use strict';



  // Explode is not, by itself, an animation. It exists to pull apart
  // other elements so that each of the pieces can be targeted by
  // animations.

  exports['default'] = explode;

  function explode() {
    var _this = this;

    for (var _len = arguments.length, pieces = Array(_len), _key = 0; _key < _len; _key++) {
      pieces[_key] = arguments[_key];
    }

    var seenElements = {};
    var sawBackgroundPiece = false;
    var promises = pieces.map(function (piece) {
      if (piece.matchBy) {
        return matchAndExplode(_this, piece, seenElements);
      } else if (piece.pick || piece.pickOld || piece.pickNew) {
        return explodePiece(_this, piece, seenElements);
      } else {
        sawBackgroundPiece = true;
        return runAnimation(_this, piece);
      }
    });
    if (!sawBackgroundPiece) {
      if (this.newElement) {
        this.newElement.css({ visibility: "" });
      }
      if (this.oldElement) {
        this.oldElement.css({ visibility: "hidden" });
      }
    }
    return liquid_fire.Promise.all(promises);
  }

  function explodePiece(context, piece, seen) {
    var childContext = Ember['default'].copy(context);
    var selectors = [piece.pickOld || piece.pick, piece.pickNew || piece.pick];
    var cleanupOld, cleanupNew;

    if (selectors[0] || selectors[1]) {
      cleanupOld = _explodePart(context, "oldElement", childContext, selectors[0], seen);
      cleanupNew = _explodePart(context, "newElement", childContext, selectors[1], seen);
      if (!cleanupOld && !cleanupNew) {
        return liquid_fire.Promise.resolve();
      }
    }

    return runAnimation(childContext, piece)["finally"](function () {
      if (cleanupOld) {
        cleanupOld();
      }
      if (cleanupNew) {
        cleanupNew();
      }
    });
  }

  function _explodePart(context, field, childContext, selector, seen) {
    var child, childOffset, width, height, newChild;
    var elt = context[field];

    childContext[field] = null;
    if (elt && selector) {
      child = elt.find(selector).filter(function () {
        var guid = Ember['default'].guidFor(this);
        if (!seen[guid]) {
          seen[guid] = true;
          return true;
        }
      });
      if (child.length > 0) {
        childOffset = child.offset();
        width = child.outerWidth();
        height = child.outerHeight();
        newChild = child.clone();

        // Hide the original element
        child.css({ visibility: "hidden" });

        // If the original element's parent was hidden, hide our clone
        // too.
        if (elt.css("visibility") === "hidden") {
          newChild.css({ visibility: "hidden" });
        }
        newChild.appendTo(elt.parent());
        newChild.outerWidth(width);
        newChild.outerHeight(height);
        var newParentOffset = newChild.offsetParent().offset();
        newChild.css({
          position: "absolute",
          top: childOffset.top - newParentOffset.top,
          left: childOffset.left - newParentOffset.left,
          margin: 0
        });

        // Pass the clone to the next animation
        childContext[field] = newChild;
        return function cleanup() {
          newChild.remove();
          child.css({ visibility: "" });
        };
      }
    }
  }

  function animationFor(context, piece) {
    var name, args, func;
    if (!piece.use) {
      throw new Error("every argument to the 'explode' animation must include a followup animation to 'use'");
    }
    if (Ember['default'].isArray(piece.use)) {
      name = piece.use[0];
      args = piece.use.slice(1);
    } else {
      name = piece.use;
      args = [];
    }
    if (typeof name === "function") {
      func = name;
    } else {
      func = context.lookup(name);
    }
    return function () {
      return liquid_fire.Promise.resolve(func.apply(this, args));
    };
  }

  function runAnimation(context, piece) {
    return new liquid_fire.Promise(function (resolve, reject) {
      animationFor(context, piece).apply(context).then(resolve, reject);
    });
  }

  function matchAndExplode(context, piece, seen) {
    if (!context.oldElement || !context.newElement) {
      return liquid_fire.Promise.resolve();
    }

    var hits = Ember['default'].A(context.oldElement.find("[" + piece.matchBy + "]").toArray());
    return liquid_fire.Promise.all(hits.map(function (elt) {
      var propValue = Ember['default'].$(elt).attr(piece.matchBy);
      var selector = "[" + piece.matchBy + "=" + propValue + "]";
      if (context.newElement.find(selector).length > 0) {
        return explodePiece(context, {
          pick: selector,
          use: piece.use
        }, seen);
      } else {
        return liquid_fire.Promise.resolve();
      }
    }));
  }

});
define('physical-design/transitions/fade', ['exports', 'liquid-fire'], function (exports, liquid_fire) {

  'use strict';


  exports['default'] = fade;

  // BEGIN-SNIPPET fade-definition
  function fade() {
    var _this = this;

    var opts = arguments[0] === undefined ? {} : arguments[0];

    var firstStep;
    var outOpts = opts;
    var fadingElement = findFadingElement(this);

    if (fadingElement) {
      // We still have some older version that is in the process of
      // fading out, so out first step is waiting for it to finish.
      firstStep = liquid_fire.finish(fadingElement, 'fade-out');
    } else {
      if (liquid_fire.isAnimating(this.oldElement, 'fade-in')) {
        // if the previous view is partially faded in, scale its
        // fade-out duration appropriately.
        outOpts = { duration: liquid_fire.timeSpent(this.oldElement, 'fade-in') };
      }
      liquid_fire.stop(this.oldElement);
      firstStep = liquid_fire.animate(this.oldElement, { opacity: 0 }, outOpts, 'fade-out');
    }
    return firstStep.then(function () {
      return liquid_fire.animate(_this.newElement, { opacity: [opts.maxOpacity || 1, 0] }, opts, 'fade-in');
    });
  }

  function findFadingElement(context) {
    for (var i = 0; i < context.older.length; i++) {
      var entry = context.older[i];
      if (liquid_fire.isAnimating(entry.element, 'fade-out')) {
        return entry.element;
      }
    }
    if (liquid_fire.isAnimating(context.oldElement, 'fade-out')) {
      return context.oldElement;
    }
  }
  // END-SNIPPET

});
define('physical-design/transitions/flex-grow', ['exports', 'liquid-fire'], function (exports, liquid_fire) {

  'use strict';


  exports['default'] = flexGrow;
  function flexGrow(opts) {
    liquid_fire.stop(this.oldElement);
    return liquid_fire.Promise.all([liquid_fire.animate(this.oldElement, { 'flex-grow': 0 }, opts), liquid_fire.animate(this.newElement, { 'flex-grow': [1, 0] }, opts)]);
  }

});
define('physical-design/transitions/fly-to', ['exports', 'liquid-fire'], function (exports, liquid_fire) {

  'use strict';



  exports['default'] = flyTo;
  function flyTo() {
    var _this = this;

    var opts = arguments[0] === undefined ? {} : arguments[0];

    if (!this.newElement) {
      return liquid_fire.Promise.resolve();
    } else if (!this.oldElement) {
      this.newElement.css({ visibility: '' });
      return liquid_fire.Promise.resolve();
    }

    var oldOffset = this.oldElement.offset();
    var newOffset = this.newElement.offset();

    var motion = {
      translateX: newOffset.left - oldOffset.left,
      translateY: newOffset.top - oldOffset.top,
      outerWidth: this.newElement.outerWidth(),
      outerHeight: this.newElement.outerHeight()
    };

    this.newElement.css({ visibility: 'hidden' });
    return liquid_fire.animate(this.oldElement, motion, opts).then(function () {
      _this.newElement.css({ visibility: '' });
    });
  }

});
define('physical-design/transitions/move-over', ['exports', 'liquid-fire'], function (exports, liquid_fire) {

  'use strict';



  exports['default'] = moveOver;

  function moveOver(dimension, direction, opts) {
    var _this = this;

    var oldParams = {},
        newParams = {},
        firstStep,
        property,
        measure;

    if (dimension.toLowerCase() === 'x') {
      property = 'translateX';
      measure = 'width';
    } else {
      property = 'translateY';
      measure = 'height';
    }

    if (liquid_fire.isAnimating(this.oldElement, 'moving-in')) {
      firstStep = liquid_fire.finish(this.oldElement, 'moving-in');
    } else {
      liquid_fire.stop(this.oldElement);
      firstStep = liquid_fire.Promise.resolve();
    }

    return firstStep.then(function () {
      var bigger = biggestSize(_this, measure);
      oldParams[property] = bigger * direction + 'px';
      newParams[property] = ['0px', -1 * bigger * direction + 'px'];

      return liquid_fire.Promise.all([liquid_fire.animate(_this.oldElement, oldParams, opts), liquid_fire.animate(_this.newElement, newParams, opts, 'moving-in')]);
    });
  }

  function biggestSize(context, dimension) {
    var sizes = [];
    if (context.newElement) {
      sizes.push(parseInt(context.newElement.css(dimension), 10));
      sizes.push(parseInt(context.newElement.parent().css(dimension), 10));
    }
    if (context.oldElement) {
      sizes.push(parseInt(context.oldElement.css(dimension), 10));
      sizes.push(parseInt(context.oldElement.parent().css(dimension), 10));
    }
    return Math.max.apply(null, sizes);
  }

});
define('physical-design/transitions/scale', ['exports', 'liquid-fire'], function (exports, liquid_fire) {

  'use strict';



  exports['default'] = scale;
  function scale() {
    var _this = this;

    var opts = arguments[0] === undefined ? {} : arguments[0];

    return liquid_fire.animate(this.oldElement, { scale: [0.2, 1] }, opts).then(function () {
      return liquid_fire.animate(_this.newElement, { scale: [1, 0.2] }, opts);
    });
  }

});
define('physical-design/transitions/scroll-then', ['exports', 'ember'], function (exports, Ember) {

  'use strict';

  exports['default'] = function (nextTransitionName, options) {
    var _this = this;

    for (var _len = arguments.length, rest = Array(_len > 2 ? _len - 2 : 0), _key = 2; _key < _len; _key++) {
      rest[_key - 2] = arguments[_key];
    }

    Ember['default'].assert('You must provide a transition name as the first argument to scrollThen. Example: this.use(\'scrollThen\', \'toLeft\')', 'string' === typeof nextTransitionName);

    var el = document.getElementsByTagName('html');
    var nextTransition = this.lookup(nextTransitionName);
    if (!options) {
      options = {};
    }

    Ember['default'].assert('The second argument to scrollThen is passed to Velocity\'s scroll function and must be an object', 'object' === typeof options);

    // set scroll options via: this.use('scrollThen', 'ToLeft', {easing: 'spring'})
    options = Ember['default'].merge({ duration: 500, offset: 0 }, options);

    // additional args can be passed through after the scroll options object
    // like so: this.use('scrollThen', 'moveOver', {duration: 100}, 'x', -1);

    return window.$.Velocity(el, 'scroll', options).then(function () {
      nextTransition.apply(_this, rest);
    });
  }

});
define('physical-design/transitions/simple-fade', ['exports', 'ember'], function (exports, Ember) {

  'use strict';



  exports['default'] = fade;
  var Velocity = Ember['default'].$.Velocity;
  function fade() {
    var _this = this;

    return Velocity.animate(this.oldElement, { opacity: 0 }, { duration: 500 }).then(function () {
      return Velocity.animate(_this.newElement, { opacity: [1, 0] }, { duration: 500, visibility: "visible" });
    });
  }

});
define('physical-design/transitions/to-down', ['exports', 'physical-design/transitions/move-over'], function (exports, moveOver) {

  'use strict';

  exports['default'] = function (opts) {
    return moveOver['default'].call(this, "y", 1, opts);
  }

});
define('physical-design/transitions/to-left', ['exports', 'physical-design/transitions/move-over'], function (exports, moveOver) {

  'use strict';

  exports['default'] = function (opts) {
    return moveOver['default'].call(this, "x", -1, opts);
  }

});
define('physical-design/transitions/to-right', ['exports', 'physical-design/transitions/move-over'], function (exports, moveOver) {

  'use strict';

  exports['default'] = function (opts) {
    return moveOver['default'].call(this, "x", 1, opts);
  }

});
define('physical-design/transitions/to-up', ['exports', 'physical-design/transitions/move-over'], function (exports, moveOver) {

  'use strict';

  exports['default'] = function (opts) {
    return moveOver['default'].call(this, "y", -1, opts);
  }

});
define('physical-design/transitions/web-fly-to', ['exports', 'ember'], function (exports, Ember) {

  'use strict';



  exports['default'] = webFlyTo;
  var RSVP = Ember['default'].RSVP;
  function webFlyTo() {
    var _this = this;

    var opts = arguments[0] === undefined ? {} : arguments[0];

    if (!this.newElement) {
      return RSVP.resolve();
    } else if (!this.oldElement) {
      this.newElement.css({ visibility: '' });
      return RSVP.resolve();
    }

    var oldOffset = this.oldElement.offset();
    var newOffset = this.newElement.offset();

    var initialState = {
      transform: 'translateX(0px) translateY(0px)',
      width: this.oldElement.width() + 'px',
      height: this.oldElement.height() + 'px'
    };

    var finalState = {
      transform: 'translateX(' + (newOffset.left - oldOffset.left) + 'px) translateY(' + (newOffset.top - oldOffset.top) + 'px)',
      width: this.newElement.width(),
      height: this.newElement.height()
    };

    return new RSVP.Promise(function (resolve) {
      _this.newElement.css({ visibility: 'hidden' });
      var animationRunner = _this.oldElement[0].animate([initialState, finalState], {
        duration: opts.duration || 500 });
      animationRunner.onfinish = function () {
        _this.oldElement.css({ visibility: 'hidden' });
        _this.newElement.css({ visibility: '' });
        resolve();
      };
    });
  }

});
/* jshint ignore:start */

/* jshint ignore:end */

/* jshint ignore:start */

define('physical-design/config/environment', ['ember'], function(Ember) {
  var prefix = 'physical-design';
/* jshint ignore:start */

try {
  var metaName = prefix + '/config/environment';
  var rawConfig = Ember['default'].$('meta[name="' + metaName + '"]').attr('content');
  var config = JSON.parse(unescape(rawConfig));

  return { 'default': config };
}
catch(err) {
  throw new Error('Could not read config from meta tag with name "' + metaName + '".');
}

/* jshint ignore:end */

});

if (runningTests) {
  require("physical-design/tests/test-helper");
} else {
  require("physical-design/app")["default"].create({"name":"physical-design","version":"0.0.0.7f9bbe0a"});
}

/* jshint ignore:end */
//# sourceMappingURL=physical-design.map