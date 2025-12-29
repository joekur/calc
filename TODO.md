# TODO

## Next (language + output)

- Support `// comments` like this in addition to `#` comments, both line and in-line
- Add some tokenization to comments, so that we can add special styling to anything within `backticks`
- Fix issue when resizing the window, changes in wrapping can cause the editor lines not to match up with their corresponding gutter result lines
  - Consider: is there an alternate way to organize the DOM where the editor line and gutter line are part of the same ancestor node? or do we need to listen to window or div resize events?
- Update our light color scheme to use better colors (solarized light)
- Multiple tabs/documents with independent calculator state.
- Document persistence and sharing
  - We want to find a good way to save and come back to calculator documents later, as well as support for independent documents
  - Share functionality would be nice - can we use the URL and compress the document into a query variable for easy sharingg / bookmarking? This way users could bookmark and organize in any way they'd like.
  - What's the best way to accomplish this with good UX without adding a backend server? Local storage?
- Add more documentation to README of supported functionality
- Add subtle indentation visual indicator to show when a line is wrapped
