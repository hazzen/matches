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

  var ensureIsMatcher = function(m) {
    if (!isMatcher(m)) {
      // TODO: use things other than Eq when warranted.
      m = new Eq(m);
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


  var IndentLines = function(indent, logger) {
    var indentStr = (new Array(1 + indent)).join(' ');
    return function() {
      var newArgs = [];
      for (var i = 0; i < arguments.length; i++) {
        var str = '' + arguments[i];
        newArgs.push(str.replace(/\n/g, '\n' + indentStr));
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
        Stringifier.printImpl_(obj[i], indent + 2, logger);
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
    } else if (isMatcher(obj)) {
      logger(indentStr, 'Matcher(');
      obj.describeTo(IndentLines(indent, logger));
      logger(')');
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


  /** Ignore matcher; matches anything. */
  var Ignore = function() {
  };
  Ignore.make = function() { return new Ignore(); };

  Ignore.prototype.matchAndDescribe = function(val, logger) {
    return true;
  };

  Ignore.prototype.describeTo = function(logger) {
    logger('is anything');
  };

  Ignore.prototype.describeNegationTo = function(logger) {
    logger('is nothing (impossible!)');
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


  /**
   * Length matcher; expects val has specified length.
   */
  var Length = function(val) {
    this.val_ = val;
  };
  Length.make = function(a) { return new Length(a); };

  Length.prototype.matchAndDescribe = function(val, logger) {
    if (this.val_ != val.length) {
      logger('which has length ', val.length);
      return false;
    }
    return true;
  };

  Length.prototype.describeTo = function(logger) {
    logger('has length ', this.val_);
  };

  Length.prototype.describeNegationTo = function(logger) {
    logger('has length other than ', this.val_);
  };

  /**
   * Contains matcher; expects val contains something matching matcher.
   *
   * NOTE: If the matched object is an object with a property "length", this
   * method will assume it is an array-like object.
   */
  var EqArray = function(arr) {
    this.arr_ = arr;
  };
  EqArray.make = function(a) { return new EqArray(a); };

  EqArray.prototype.matchAndDescribe = function(val, logger) {
    if (!Array.isArray(val)) {
      logger('which isn\'t an array');
      return false;
    }
    if (val.length != this.arr_.length) {
      logger('which has the wrong length; found ', val.length, ' and expected ',
             this.arr_.length);
      return false;
    }
    for (var i = 0; i < this.arr_.length; i++) {
      var ithMatcher = ensureIsMatcher(this.arr_[i]);
      var logObj = thatHelper(val[i], ithMatcher);
      if (logObj) {
        logger('which doesn\'t match at at index ', i, ': <\n  ');
        logObj.logTo(IndentLines(2, logger));
        logger('\n>');
        return false;
      }
    }
    return true;
  };

  EqArray.prototype.describeTo = function(logger) {
    logger('is an array with elements ');
    Stringifier.print(this.arr_, logger);
  };

  EqArray.prototype.describeNegationTo = function(logger) {
    logger('is an array different than ');
    Stringifier.print(this.arr_, logger);
  };


  /**
   * thatHelper, main match function implementation.
   *
   * Tries to match val using matcher; on failure, returns a StringLogger of
   * the errors. Otherwise returns null.
   */
  var thatHelper = function(val, matcher) {
    // Horribly inefficient to do all this logging, don't care for now.
    matcher = throwIfNotMatcher(matcher);
    var logObj = new StringLogger();
    var logger = logObj.logFn.bind(logObj);
    logger('Expected: ');
    matcher.describeTo(logger);
    logger('\nActual: ');
    Stringifier.print(val, logger);

    var logMatch = new StringLogger();
    var matched = matcher.matchAndDescribe(val, logMatch.logFn.bind(logMatch));
    if (logMatch.contents()) {
      logger('\n');
      logMatch.logTo(logger);
    }
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


  exports._ = Ignore.make();
  exports.Eq = Eq.make;
  exports.Not = Not.make;
  exports.Null = Null;
  exports.Undefined = Undefined;
  exports.Contains = Contains.make;
  exports.Length = Length.make;
  exports.EqArray = EqArray.make;

  exports.that = that;
  exports.assertThat = assertThat;

})(window.exports ? window.exports : window);
