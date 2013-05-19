(function(exports) {

  /** Generic helpers. */
  var nullFn = function() {};
  var range = function(endOrStart, opt_end, opt_step) {
    var end = opt_end == null ? endOrStart : opt_end;
    var start = opt_end == null ? 0 : endOrStart;
    var step = opt_step || 1;
    var arr = [];
    while (start < end) {
      arr.push(start);
      start += step;
    }
    return arr;
  };
  var sum = function() {
    var v = 0;
    for (var i = 0; i < arguments.length; i++) {
      v += arguments[i];
    }
    return v;
  };



  var BaseMatcher = function() {};
  BaseMatcher.prototype.describeNegationTo = function(logger) {
    logger('not(');
    this.describeTo(logger);
    logger(')');
  };

  var isMatcher = function(m) {
    return m && m.describeTo && m.describeNegationTo && m.matchAndDescribe;
  };

  var throwIfNotMatcher = function(m, name) {
    if (!isMatcher(m)) {
      throw Error('Expected a matcher for <' + name + '> but got <' + m + '>');
    }
    return m;
  };


  /**
   * StringLogger.
   *
   * Logger implementation that buffers all logs internally and can either
   * output the result to another logger or to a string.
   */
  var StringLogger = function() {
    this.logged_ = [];
  };

  StringLogger.prototype.logFn = function() {
    Array.prototype.push.apply(this.logged_, arguments);
  };

  StringLogger.prototype.contents = function() {
    return this.logged_.join('');
  };

  StringLogger.prototype.logTo = function(logger) {
    logger.apply(null, this.logged_);
  };


  var Chomp = function(num, logger) {
    return function() {
      var newArgs = [];
      for (var i = 0; i < arguments.length; i++) {
        var str = '' + arguments[i];
        if (num == 0) {
          newArgs.push(str);
        } else if (str.length <= num) {
          num -= str.length;
        } else {
          newArgs.push(str.substr(num));
          num = 0;
        }
      }
      logger.apply(null, newArgs);
    };
  };


  /**
   * Stringifier.
   *
   * Pretty-print objects of any kind.
   *
   * Or, at least, try to.
   */
  var Stringifier = {};

  Stringifier.printImpl_ = function(obj, indent, logger) {
    var indentStr = (new Array(1 + indent)).join(' ');
    if (Array.isArray(obj)) {
      logger(indentStr, '[\n');
      for (var i = 0; i < obj.length; i++) {
        Stringifier.printImpl_(obj[i], indent + 2, Chomp(indent + 2, logger));
        logger(',\n');
      }
      logger(indentStr, ']');
    } else if (obj == null ||
               obj.constructor == Boolean ||
               obj.constructor == Date ||
               obj.constructor == Function ||
               obj.constructor == Number ||
               obj.constructor == RegExp) {
      logger(indentStr, '' + obj);
    } else if (obj.constructor == String) {
      logger(indentStr, '"', obj, '"');
    } else {
      logger(indentStr, '{\n');
      for (var key in obj) {
        logger('  ', indentStr, key, ': ');
        Stringifier.printImpl_(obj[key], indent + 2, Chomp(indent + 2, logger));
        logger(',\n');
      }
      logger(indentStr, '}');
    }
  };

  Stringifier.print = function(obj, logger) {
    Stringifier.printImpl_(obj, 0, logger);
  };



  /** Eq matcher; matches val and only val. */
  var Eq = function(val) {
    this.val_ = val;
  };
  Eq.make = function(val) { return new Eq(val); };

  Eq.prototype.matchAndDescribe = function(val, logger) {
    return val === this.val_;
  };

  Eq.prototype.describeTo = function(logger) {
    logger('is ');
    Stringifier.print(this.val_, logger);
  };

  Eq.prototype.describeNegationTo = function(logger) {
    logger('is\'nt ');
    Stringifier.print(this.val_, logger);
  };


  /** Null matcher; matches null and only null. */
  var Null = Eq.make(null);


  /** Undefined matcher; matches undefined and only undefined. */
  var Undefined = Eq.make(undefined);


  /** Not matcher; wraps and negates another matcher. */
  var Not = function(matcher) {
    this.matcher_ = throwIfNotMatcher(matcher, 'Not');
  };
  Not.make = function(m) { return new Not(m); };

  Not.prototype.matchAndDescribe = function(val, logger) {
    return !this.matcher_.matchAndDescribe(val, logger);
  };

  Not.prototype.describeTo = function(logger) {
    this.matcher_.describeNegationTo(logger);
  };

  Not.prototype.describeNegationTo = function(logger) {
    this.matcher_.describeTo(logger);
  };


  /**
   * Contains matcher; expects val contains something matching matcher.
   *
   * NOTE: If the matched object is an object with a property "length", this
   * method will assume it is an array-like object.
   */
  var Contains = function(matcher) {
    this.matcher_ = throwIfNotMatcher(matcher, 'Contains');
  };
  Contains.make = function(m) { return new Contains(m); };

  Contains.prototype.matchAndDescribe = function(val, logger) {
    if (val.length) {
      for (var i = 0; i < val.length; i++) {
        if (this.matcher_.matchAndDescribe(val[i], nullFn)) return true;
      }
    } else {
      for (var k in val) {
        if (this.matcher_.matchAndDescribe(val[k], nullFn)) return true;
      }
    }
    return false;
  };

  Contains.prototype.describeTo = function(logger) {
    logger('contains an element that ');
    this.matcher_.describeTo(logger);
  };

  Contains.prototype.describeNegationTo = function(logger) {
    logger('contains no element that ');
    this.matcher_.describeTo(logger);
  };

  var thatHelper = function(val, matcher) {
    // Horribly inefficient to do all this logging, don't care for now.
    matcher = throwIfNotMatcher(matcher);
    var logObj = new StringLogger();
    var logger = logObj.logFn.bind(logObj);
    logger('Expected: ');
    matcher.describeTo(logger);
    logger('\nActual: ');
    Stringifier.print(val, logger);
    var matched = matcher.matchAndDescribe(val, logger);
    return matched ? null : logObj;
  };


  /**
   * that, the main match function.
   */
  var that = function(val, matcher) {
    return !thatHelper(val, matcher);
  };

  var assertThat = function(val, matcher) {
    var logObj = thatHelper(val, matcher);
    if (logObj) {
      console.log(logObj.contents());
      throw Error('Assertion error!');
    }
  };


  var make = function(cls) {
    return cls.con
  };


  exports.Eq = Eq.make;
  exports.Not = Not.make;
  exports.Null = Null;
  exports.Undefined = Undefined;
  exports.Contains = Contains.make;
  exports.that = that;
  exports.assertThat = assertThat;

})(window.exports ? window.exports : window);
