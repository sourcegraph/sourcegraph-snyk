# Snyk Sourcegraph extension


## Configuration

The extension can be configured through JSON in user, organization or global settings.

```jsonc
{
  // A Snyk API token.
  "snyk.apiToken": "...",

  // The Snyk extension needs to map the repository on Sourcegraph to a project inside an organization on
  // Snyk. The default settings work for most projects on Snyk, but if you have a custom setup, you
  // can configure the following settings.

  // This regular expression is matched on the repository name. The values from the capture groups are
  // available in the templates below.
  "snyk.repositoryNamePattern": "(?:^|/)([^/]+)/([^/]+)$",
  // This template is used to form the Snyk organization key.
  // By default, the second-last part of the repository name (first capture group above) is used as-is.
  // E.g. "apache" from "github.com/apache/struts".
  "snyk.organizationKeyTemplate": "$1",

  // CORS headers are necessary for the extension to fetch data, but Snyk does not send them by default.
  // Here you can customize the URL to an HTTP proxy that adds CORS headers.
  // By default Sourcegraph's CORS proxy is used.
  "snyk.corsAnywhereUrl": "https://cors-anywhere.herokuapp.com"
}
```

