System.config({
  "baseURL": "/",
  "transpiler": "babel",
  "babelOptions": {
    "optional": [
      "runtime"
    ]
  },
  "paths": {
    "github:*": "jspm_packages/github/*.js",
    "npm:*": "jspm_packages/npm/*.js",
    "*": "*.js"
  },
  "defaultJSExtensions": true
});

System.config({
  "map": {
    "angular": "github:angular/bower-angular@1.4.0",
    "angular/bower-angular": "github:angular/bower-angular@1.4.0",
    "babel": "npm:babel-core@5.5.8",
    "babel-runtime": "npm:babel-runtime@5.5.8",
    "core-js": "npm:core-js@0.9.17",
    "rx": "npm:rx@2.5.3",
    "rx-angular": "npm:rx-angular@0.0.14",
    "github:jspm/nodelibs-process@0.1.1": {
      "process": "npm:process@0.10.1"
    },
    "npm:babel-runtime@5.5.8": {
      "process": "github:jspm/nodelibs-process@0.1.1"
    },
    "npm:core-js@0.9.17": {
      "fs": "github:jspm/nodelibs-fs@0.1.2",
      "process": "github:jspm/nodelibs-process@0.1.1",
      "systemjs-json": "github:systemjs/plugin-json@0.1.0"
    },
    "npm:rx-angular@0.0.14": {
      "rx": "npm:rx@2.5.3"
    },
    "npm:rx@2.5.3": {
      "process": "github:jspm/nodelibs-process@0.1.1"
    }
  }
});

