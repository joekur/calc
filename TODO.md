# TODO

- Support `// comments` like this in addition to `#` comments, both line and in-line
- Add some tokenization to comments, so that we can add special styling to anything within `backticks`
- Multiple tabs/documents with independent calculator state.
- Document persistence and sharing
  - We want to find a good way to save and come back to calculator documents later, as well as support for independent documents
  - Share functionality would be nice - can we use the URL and compress the document into a query variable for easy sharingg / bookmarking? This way users could bookmark and organize in any way they'd like.
  - What's the best way to accomplish this with good UX without adding a backend server? Local storage?
- Add more documentation to README of supported functionality
- Add subtle indentation visual indicator to show when a line is wrapped
- Support implicit multiplication on parens, eg `2(3)` == `2 * 3`
- More units: time durations (ms/s/min/hr), speed (mph, km/h), data sizes (MB, GiB), angles (deg, rad).
