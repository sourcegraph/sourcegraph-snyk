# Snyk Sourcegraph extension


### Code Insight

<p>
<picture>
<source srcset="https://user-images.githubusercontent.com/37420160/97132254-b948a100-171c-11eb-8dac-d0c02b4ca946.png" media="(prefers-color-scheme: dark)">
<source srcset="https://user-images.githubusercontent.com/37420160/97132234-ac2bb200-171c-11eb-84ac-949c60ceeb82.png" media="(prefers-color-scheme: light)">
<img src="https://user-images.githubusercontent.com/37420160/97132234-ac2bb200-171c-11eb-84ac-949c60ceeb82.png" alt="Screenshot">
</picture>
</p>


### Notification + Panel View

<p>
<picture>
<source srcset="https://user-images.githubusercontent.com/37420160/97132302-d8dfc980-171c-11eb-9d5d-36379841cb3e.png" media="(prefers-color-scheme: dark)">
<source srcset="https://user-images.githubusercontent.com/37420160/97132290-cf566180-171c-11eb-8914-2c39d58cf593.png" media="(prefers-color-scheme: light)">
<img src="https://user-images.githubusercontent.com/37420160/97132290-cf566180-171c-11eb-8914-2c39d58cf593.png" alt="Screenshot">
</picture>
</p>



## Configuration

The extension can be configured through JSON in user, organization or global settings.

```jsonc
{
  // A Snyk API token.
  "snyk.apiToken": "...",

  // Whether to show notifications when Snyk has found issues in the currently viewed project
  "snyk.showNotifications": true,

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

