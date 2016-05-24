## Dependencies

The project has a number of dependencies. To get a better
idea what these do,

```
npm install -g package-describe
package-describe
```




## Suggestions for Cleanup

- separate command from input/output
- commands can return promises, and the invoker manages catching exceptions, and progress updates for long running commands.
- move input/output from BaseCommand to collaborator classes, allowing input/output to be more easily mocked
- avoid direct wrotes to console.log() - output handled by an outputter strategy instance
- use nopts to centralize command parsing - command parameters are provided as a map to each command
- commands API is a node API rather than a command-line (args/input/output/error streams)
  so they can be more easily reused in other projects
- with input/output managed as a strategy, pretty printing/coloring or raw command output will simple to implement
- avoid hard-coded strings for UX, so i18n becomes possible
- add eslint rules to help enforce best practices writing interface-independent commands
- end to end tests for all commands
- ES6/7
- add version check for node early on startup to validate version requirements?
