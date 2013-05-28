MatchEs
=======

A (very in-progress) JavaScript matcher library based heavily on googlemock's "[Matcher][1]" idiom. Why? Because
```javascript
assertThat(ApproximateMath.PI, And(Le(4), Ge(3)));
```
is a much better than
```javascript
assertTrue(ApproximateMath.PI <= 4, 'Approximate PI should be less than or equal to 4');
assertTrue(ApproximateMath.PI >= 3, 'Approximate PI should be greater than or equal to 3');
```
Note MatchEs is _not_ a complete testing framework; it only provides an `asserThat` method and
a library of pre-defined matchers. You have no reason to use it over any other options. The original
impetus for implentation was an exercise and to scratch an itch.

[1]:https://code.google.com/p/googlemock/wiki/CheatSheet#Matchers
