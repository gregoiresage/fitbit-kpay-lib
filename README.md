# What is this?
The library to use Fitbit clockfaces and apps with the <a href="https://k-pay.io" target="_blank">k-pay system</a>

**DO NOT USE THIS CODE TO RELEASE A NEW FITBIT APP OR CLOCKFACE YOU WANT TO SELL WITH KPAY!!** 

If you want to release a paid app or clockface in the Fitbit gallery, create an account on the <a href="https://k-pay.io" target="_blank">k-pay website</a> and follow the documentation. 
Only use the k-pay lib you download from that website in your apps/clockfaces because each lib you download is uniquely adapted to work for your specific product.

This open source version is only intended for developer interested in improving the library itself. Changed made and accepted here will soon be available for everyone via the k-pay website.

# How to test
This is a completely functional Fitbit app for the Fitbit Ionic or Versa watches. Import in Fitbit Studio (or build with the command line SDK) and run it in the simulator to test.

# How to contribute
Any contribution is welcome, please create a pull request for any changes you think would contribute to make this library better for everyone using k-pay.

We are especially looking for ways to decrease the memory usage of the lib without sacrificing functionality!

Do not waste time saving memory by making variable or function names shorter or doing other things UglifyJS is way better at. This lib is processed with UglifyJS before it's released to the k-pay website.
