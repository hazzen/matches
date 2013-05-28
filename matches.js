(function(exports) {

  /** Generic helpers. */
  var defaultLogger = function(contents) {
    console.log(contents);
  };

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

  var logMatchesTo = function(logger) {
    defaultLogger = logger;
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


  var PredMatcher = function(pred, yay, nay) {
    this.pred_ = pred;
    this.yay_ = yay;
    this.nay_ = nay;
  };
  PredMatcher.make = function() { return new PredMatcher(); };

  PredMatcher.prototype.matchAndDescribe = function(val, logger) {
    return this.pred_(val);
  };

  PredMatcher.prototype.describeTo = function(logger) {
    logger(this.yay_);
  };

  PredMatcher.prototype.describeNegationTo = function(logger) {
    logger(this.nay_);
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
   * Array-equality matcher.
   *
   * Matches one array with an array of values and/or matchers.
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
    var header = false;
    for (var i = 0; i < this.arr_.length; i++) {
      var ithMatcher = ensureIsMatcher(this.arr_[i]);
      var logObj = new StringLogger();
      if (!ithMatcher.matchAndDescribe(val[i], logObj.logFn.bind(logObj))) {
        if (!header) {
          logger('which doesn\'t match at these indices:\n');
          header = true;
        } else {
          logger(',\n');
        }
        logger('index ', i);
        if (logObj.contents()) {
          logger(' ');
          logObj.logTo(logger);
        }
      }
    }
    // TODO: describe matches for success case (in case negated).
    return !header;
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
   * Key/Value matchers.
   */
  var KeyValIgnoreSentinel = new Object();

  var KeyValImpl = function(key, val) {
    this.key_ = key;
    this.val_ = val;
  };
  KeyValImpl.make = function(k, v) { return new KeyValImpl(k, v); };

  KeyValImpl.prototype.matchAndDescribe = function(val, logger) {
    var key = val.key;
    var val = val.val;
    if (this.key_ != KeyValIgnoreSentinel) {
      var keyLogger = new StringLogger();
      if (!ensureIsMatcher(this.key_).matchAndDescribe(
              key, keyLogger.logFn.bind(keyLogger))) {
        if (keyLogger.contents()) {
          logger('whose key ');
          keyLogger.logTo(logger);
        }
        return false;
      }
    }
    if (this.val_ != KeyValIgnoreSentinel) {
      var valLogger = new StringLogger();
      if (!ensureIsMatcher(this.val_).matchAndDescribe(
              val, valLogger.logFn.bind(valLogger))) {
        if (valLogger.contents()) {
          logger('whose value ');
          val.logTo(logger);
        }
        return false;
      }
    }
    return true;
  };

  KeyValImpl.prototype.describeTo = function(logger) {
    logger('is a key/value ');
    if (this.key == KeyValIgnoreSentinel) {
      logger('with value ');
      Stringifier.print(this.val_, logger);
    } else if (this.val == KeyValIgnoreSentinel) {
      logger('with key ');
      Stringifier.print(this.key_, logger);
    } else {
      logger('(');
      Stringifier.print(this.key_, logger);
      logger(', ');
      Stringifier.print(this.val_, logger);
      logger(')');
    }
  };

  KeyValImpl.prototype.describeNegationTo = function(logger) {
    logger('is a key/value ');
    if (this.key == KeyValIgnoreSentinel) {
      logger('with value different from ');
      Stringifier.print(this.val_, logger);
    } else if (this.val == KeyValIgnoreSentinel) {
      logger('with key different from ');
      Stringifier.print(this.key_, logger);
    } else {
      logger('different from (');
      Stringifier.print(this.key_, logger);
      logger(', ');
      Stringifier.print(this.val_, logger);
      logger(')');
    }
  };


  /**
   * Dict matcher.
   */
  var EqDict = function(dict) {
    if (arguments.length > 1 || isMatcher(dict)) {
      this.matchers_ = Array.prototype.slice.apply(arguments);
    } else {
      this.dict_ = dict;
    }
  };
  EqDict.make = function(d) { return new EqDict(d); };

  EqDict.prototype.dictMatch_ = function(val, logger) {
    var keys = Object.keys(val);
    var matchedKeys = {};
    var unexpected = [];
    var header = false;
    var matched = true;
    for (var i = 0; i < keys.length; i++) {
      var key = keys[i];
      if (key in this.dict_) {
        var keyMatch = ensureIsMatcher(this.dict_[key]);
        var valLogger = new StringLogger();
        matchedKeys[key] = true;
        if (!keyMatch.matchAndDescribe(val[key], valLogger.logFn.bind(valLogger))) {
          matched = false;
          if (!header) {
            logger('which doesn\'t match for these keys:\n');
            header = true;
          } else {
            logger(',\n');
          }
          logger('key ', key);
          if (valLogger.contents()) {
            logger(' ');
            valLogger.logTo(logger);
          }
        }
      } else {
        unexpected.push(key);
      }
    }
    var missing = Object.keys(this.dict_);
    missing = missing.filter(function(k) { return !(k in matchedKeys); });
    matched = matched && !missing.length && !unexpected.length;
    return {matched: matched, unexpected: unexpected, missing: missing};
  };

  EqDict.prototype.matchersMatch_ = function(val, logger) {
    var keys = Object.keys(val);
    var unmatchedMatchers = {};
    this.matchers_.forEach(function(m, i) { unmatchedMatchers[i] = true; });
    var unexpected = [];
    var header = false;
    var matched = true;
    for (var i = 0; i < keys.length; i++) {
      var kv = {key: keys[i], val: val[keys[i]]};
      var valLogger = new StringLogger();
      var foundMatch = false;
      for (var j = 0; j < this.matchers_.length; j++) {
        var keyMatch = this.matchers_[j];
        if (keyMatch.matchAndDescribe(kv, valLogger.logFn.bind(valLogger))) {
          foundMatch = true;
          delete unmatchedMatchers[j];
        }
      }
      if (!foundMatch) {
        matched = false;
        if (!header) {
          logger('which had not matcher for these keys:\n');
          header = true;
        } else {
          logger(',\n');
        }
        logger('key ', kv.key);
      }
    }
    var missing = Object.keys(unmatchedMatchers).map(function(index) {
      return this.matchers_[index];
    }, this);
    matched = matched && !missing.length && !unexpected.length;
    return {matched: matched, unexpected: unexpected, missing: missing};
  };

  EqDict.prototype.matchAndDescribe = function(val, logger) {
    var matchedStruct;
    if (this.dict_) {
      matchedStruct = this.dictMatch_(val, logger);
    } else {
      matchedStruct = this.matchersMatch_(val, logger);
    }
    if (matchedStruct.unexpected.length) {
      logger('\nwhich had unexpected keys ');
      Stringifier.print(matchedStruct.unexpected, logger);
    }
    if (matchedStruct.missing.length) {
      logger('\nwhich didn\'t have expected keys ');
      Stringifier.print(matchedStruct.missing, logger);
    }
    return matchedStruct.matched;
  };

  EqDict.prototype.describeTo = function(logger) {
    if (this.dict_) {
      logger('is an object with elements ');
      Stringifier.print(this.dict_, logger);
    }
  };

  EqDict.prototype.describeNegationTo = function(logger) {
    if (this.dict_) {
      logger('is an object different than ');
      Stringifier.print(this.dict_, logger);
    }
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
      defaultLogger(logObj.contents());
      throw Error('Assertion error!');
    }
  };


  var make = function(cls) {
    return cls.con
  };


  exports._ = Ignore.make();
  exports.Eq = Eq.make;
  exports.Le = function(v) {
    return new PredMatcher(
      function(t) { return t <= v; },
      'is less than or equal to ' + v,
      'is greater than ' + v);
  };
  exports.Lt = function(v) {
    return new PredMatcher(
      function(t) { return t < v; },
      'is less than ' + v,
      'is greater than or equal to ' + v);
  };
  exports.Ge = function(v) { return new Not(exports.Lt(v)); };
  exports.Gt = function(v) { return new Not(exports.Le(v)); };
  exports.Not = Not.make;
  exports.Null = Null;
  exports.Undefined = Undefined;
  exports.Contains = Contains.make;
  exports.Length = Length.make;
  exports.EqArray = EqArray.make;
  exports.KeyVal = KeyValImpl.make;
  exports.Key = function(k) { return new KeyValImpl(k, KeyValIgnoreSentinel); };
  exports.Val = function(v) { return new KeyValImpl(KeyValIgnoreSentinel, v); };
  exports.EqDict = EqDict.make;

  exports.that = that;
  exports.assertThat = assertThat;
  exports.logMatchesTo = logMatchesTo;

})(window.exports ? window.exports : window);
