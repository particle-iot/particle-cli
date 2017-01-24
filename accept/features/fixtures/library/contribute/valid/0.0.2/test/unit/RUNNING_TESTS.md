How to Run Tests
===

We're currently not sure what the best way to do [test driven embedded development](http://pragprog.com/book/jgade/test-driven-development-for-embedded-c) for Spark is.  Here's what we know about how a Spark library should be unit tested:

Desired Developer Experience
---

The user of a library to be able to do:

    git clone the-library.git
    cd the-library/firmware/test
    make test

And see a bunch of test output like this:

    running unit tests ......
    test/test1.cpp:343: error: Failure in UberLibraryExample.blabla: false

- Unit tests should run on a regular computer, not a Spark Core.
- A developer should be able to cd into `firmware/test` and type `make` to run the unit tests (as illustrated above)
- The tests should stub out Spark specific functionality so the code compiles and runs using on a
  standard GNU C++ compiler.
- When the compiled binary is run, it should print out a "." for each successful test. Failing tests should have a descriptive name and point to the file and line number of the test.
- When any test fails, the binary should return a non-zero exit code.

How to help out
---

If you have ideas about how to do this, please start a conversation at [community.spark.io](http://community.spark.io), or fork this repository and issue a pull request that illustrates how to do unit testing of a Spark Library.
