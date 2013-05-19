(function(exports) {

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


  var ConsoleLogger = function() {
    this.logged_ = [];
  };

  ConsoleLogger.prototype.logFn = function() {
    Array.prototype.push.apply(this.logged_, arguments);
  };

  ConsoleLogger.prototype.logTo = function(logger) {
    logger(this.logged_.join(''));
  };

  ConsoleLogger.prototype.write = function() {
    console.log(this.logged_.join(''));
  };


  var nullFn = function() {};


  /** Eq matcher; matches val and only val. */
  var Eq = function(val) {
    this.val_ = val;
  };
  Eq.make = function(val) { return new Eq(val); };

  Eq.prototype.matchAndDescribe = function(val, logger) {
    return val === this.val_;
  };

  Eq.prototype.describeTo = function(logger) { logger('is ', this.val_); };

  Eq.prototype.describeNegationTo = function(logger) { logger('is\'nt ', this.val_); };


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
    var logger = new ConsoleLogger();
    logger.logFn('Expected: ');
    matcher.describeTo(logger.logFn.bind(logger));
    logger.logFn('\nActual: ', val);
    var matched = matcher.matchAndDescribe(val, logger);
    return matched ? null : logger;
  };


  /**
   * that, the main match function.
   */
  var that = function(val, matcher) {
    return !thatHelper(val, matcher);
  };

  var assertThat = function(val, matcher) {
    var logger = thatHelper(val, matcher);
    if (logger) {
      logger.write();
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
