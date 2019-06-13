![roadtrip](https://github.com/timomeh/roadtrip/raw/master/.github/banner.png)

Roadtrip is a CLI Tool to deploy and host static sites on AWS S3 and CloudFront,
and manage DNS records using Route53 (optional).

<!-- toc -->

- [💡 How it works](#-how-it-works)
- [🕶 At a glance](#-at-a-glance)
- [👩‍💻 Install & Deploy](#-install--deploy)
- [📝 Configuration](#-configuration)
- [🔭 Branch Previews](#-branch-previews)
- [🔨 Command Reference](#-command-reference)
- [Alternatives](#alternatives)
- [License](#license)
  <!-- tocstop -->

# 💡 How it works

Roadtrip uploads your website's files to an S3 bucket and configures it as a
static website. On your first deploy, it creates a CloudFront Distribution (CDN)
which serves files from the S3 bucket. This will make your website load much
faster, and allows you to use https (which isn't supported by S3's website hosting).
CloudFront takes ~10 minutes to roll out the new distribution.

Optionally Roadtrip will also create a DNS alias record in Route53. If you don't
manage your nameserver through Route53, you can create a CNAME manually.

The files on the CloudFront's servers will be cached for 1 year. If you deploy
changes, Roadtrip will invalidate those caches, causing CloudFront to fetch the
new version of your site.

# 🕶 At a glance

```sh
$ npm i -g roadtrip-cli

$ roadtrip project:deploy --connectDomain
  ✔ Create bucket
  ✔ Make bucket a website
  ✔ Synced 21 files
  ✔ Create distribution
  ↓ Invalidate paths on CDN [skipped]
    → The distribution was just created. No paths to invalidate.
  ✔ Connect dns entry

Note: The distribution was just set up.
It can take up to 10-20 minutes to be fully available.

=> CloudFront domain: a21xi98r7tykj.cloudfront.net
```

# 👩‍💻 Install & Deploy

### 1. Setup AWS Credentials

Create an API user in AWS's IAM Console with access to S3, CloudFront, ACM and Route53.

(TODO: provide policy config)

Add the credentials to the machine where you're deploying from:

- You can use `~/.aws/credentials` and set the environment variable `AWS_PROFILE=your_profile_name`.
- You can use the environment variables `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` and `AWS_DEFAULT_REGION`

Read more here: https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-envvars.html

### 2. Install Roadtrip

```
$ npm i -g roadtrip-cli
```

### 3. Add a `roadtrip.json` to your project

```json
{
  "name": "example-project",
  "dir": "./build"
}
```

### 4. Deploy

Run `project:deploy` inside your project directory to deploy and configure everything.

```
$ roadtrip project:deploy
```

# 📝 Configuration

Put a `roadtrip.json` in the root of your project.

Example:

```json
{
  "name": "example-project",
  "domain": "example.com",
  "dir": "./build",
  "https": false,
  "cdn": true,
  "indexFile": "index.html",
  "errorFile": "404.html",
  "cacheControl": {
    "**/*.js": "public, max-age=31536000, immutable"
  }
}
```

#### name

Type: `String`

The name of your project. This will be the bucket's name. Can be overridden with
the `--name` flag.

#### domain

Type: `String`

A custom domain which will be added as alias to CloudFront. This allows you to
add the CloudFront domain as CNAME to your domain.

If you don't specify a domain, you can still use the random CloudFront domain.

##### Automatically connect cloudfront to your domain

Using the `--connectDomain` flag, roadtrip will automatically add an alias
(CNAME) to your dns records.

This only works if you use AWS Route53 as nameserver. Create a hosted zone for
your domain in AWS Route53, if you don't already have one. The record will
automatically be added to the hosted zone for your domain.

#### dir

Type: `String`  
Default: `.`

The directory to sync with the bucket.

#### https

Type: `Boolean`  
Default: `false`

Use `true` to enable https. If you use a custom domain, you must have a valid
certificate in AWS' Certificate Manager.

##### Custom Domain & https

You can use a custom domain and enable https: add a certificate for your domain
inside AWS' Certificate Manager. AWS Certificates cost **\$0**.

You can also use a wildcard certificate, e.g. for different environments on
subdomains. Remember that a wildcard is only valid for one domain level.  
Example: `*.example.com` works with `foo.example.com`, but not with `foo.bar.example.com`

#### cdn

Type: `Boolean`  
Default: `true`

Set this to `false` won't create a CloudFront distribution. You can still access
your site with the S3 bucket's domain and use this domain as CNAME for a custom
domain.

#### indexFile

Type: `String`  
Default: `index.html`

The file which will act as index page.

#### errorFile

Type: `String`  
Default: `404.html`

The file which will act as 404 page.

#### cacheControl

Type: `Object`  
Default: `{}`

Allows to add custom `Cache-Control` headers to the bucket's files using glob
matching.

Example:

```json
{
  "cacheControl": {
    "**/*.{js,css}": "public, max-age=31536000, immutable",
    "**/*.json": "private, max-age=0, must-revalidate"
  }
}
```

If multiple globs match, the last match will be applied. Globs are matched with
[minimatch](https://www.npmjs.com/package/minimatch).

If no matches are found, these rules will be applied:

- `**/\*.html`:`private, max-age=0, no-cache, no-store, must-revalidate`  
  This won't cache html files in the browser, even if the page was loaded with a
  history even (e.g. browser's back button). For more infos, [check this article](https://engineering.mixmax.com/blog/chrome-back-button-cache-no-store).

- `**/\*`:`public, max-age=0, must-revalidate`  
  This won't cache any files in the browser, but less agressive than html files.

Additionally, `s-maxage=31536000` will be appended if no `s-maxage` directive is
set. This tells CloudFront to cache files for 1 year. Don't worry, the
CloudFront cache will be invalidated during your roadtrip deployment.

If you change `cacheControl`, all files will be synced during your next
deployment, which will update all `Cache-Control` headers.

Warning: Without the globstar (`**/`), only files in the root will match.
Example: `*.png` will match `launch.png`, but not `assets/launch.png`. To match
all png's, use `**/*.png`.

# 🔭 Branch Previews

You can also use Roadtrip to create preview environments of a branch by
overriding the project's name with the `--name` flag.

```sh
$ roadtrip project:deploy --name=example-project-${BRANCH_NAME}
```

Keep in mind that CloudFront needs ~10 minutes to roll out new distributions, so
your branch preview won't be available immediately. If you want a preview
without this delay, you can:

- Have some environments already set-up.
- Don't use CloudFront (which also means you can't use https).

```sh
$ roadtrip project:deploy \
  --name=example-project-${BRANCH_NAME} \
  --domain=preview-${BRANCH_NAME}.example.com \
  --skipCDN
  --connectDomain
```

# 🔨 Command Reference

<!-- commands -->

- [`roadtrip autocomplete [SHELL]`](#roadtrip-autocomplete-shell)
- [`roadtrip bucket:create`](#roadtrip-bucketcreate)
- [`roadtrip bucket:setup`](#roadtrip-bucketsetup)
- [`roadtrip bucket:sync`](#roadtrip-bucketsync)
- [`roadtrip bucket:website`](#roadtrip-bucketwebsite)
- [`roadtrip distribution:create`](#roadtrip-distributioncreate)
- [`roadtrip distribution:invalidate`](#roadtrip-distributioninvalidate)
- [`roadtrip domain:connect ALIAS`](#roadtrip-domainconnect-alias)
- [`roadtrip help [COMMAND]`](#roadtrip-help-command)
- [`roadtrip project:deploy`](#roadtrip-projectdeploy)
- [`roadtrip update [CHANNEL]`](#roadtrip-update-channel)

## `roadtrip autocomplete [SHELL]`

display autocomplete installation instructions

```
USAGE
  $ roadtrip autocomplete [SHELL]

ARGUMENTS
  SHELL  shell type

OPTIONS
  -r, --refresh-cache  Refresh cache (ignores displaying instructions)

EXAMPLES
  $ roadtrip autocomplete
  $ roadtrip autocomplete bash
  $ roadtrip autocomplete zsh
  $ roadtrip autocomplete --refresh-cache
```

_See code: [@oclif/plugin-autocomplete](https://github.com/oclif/plugin-autocomplete/blob/v0.1.1/src/commands/autocomplete/index.ts)_

## `roadtrip bucket:create`

create roadtrip s3 bucket

```
USAGE
  $ roadtrip bucket:create

OPTIONS
  -c, --config=config  [default: roadtrip.json] path to a roadtrip configuration file
  -d, --domain=domain  custom domain for cloudfront
  -n, --name=name      name of the project
  --[no-]https         set up the site with https
  --verbose            turn on verbose output

DESCRIPTION
  Creates a bucket with the name of the site. Does nothing if the bucket already exists.
```

_See code: [src/cli/bucket/create.js](https://github.com/railslove/roadtrip/blob/v1.1.0/src/cli/bucket/create.js)_

## `roadtrip bucket:setup`

fully setup roadtrip s3 bucket

```
USAGE
  $ roadtrip bucket:setup

OPTIONS
  -c, --config=config  [default: roadtrip.json] path to a roadtrip configuration file
  -d, --domain=domain  custom domain for cloudfront
  -n, --name=name      name of the project
  --[no-]https         set up the site with https
  --verbose            turn on verbose output

DESCRIPTION
  Creates, configures and syncs a project. It runs bucket:setup, bucket:website and bucket:sync consecutively.
```

_See code: [src/cli/bucket/setup.js](https://github.com/railslove/roadtrip/blob/v1.1.0/src/cli/bucket/setup.js)_

## `roadtrip bucket:sync`

syncs the project to the s3 bucket

```
USAGE
  $ roadtrip bucket:sync

OPTIONS
  -c, --config=config  [default: roadtrip.json] path to a roadtrip configuration file
  -d, --domain=domain  custom domain for cloudfront
  -n, --name=name      name of the project
  --[no-]https         set up the site with https
  --verbose            turn on verbose output

DESCRIPTION
  Checks which files have changed and creates/updates/deletes them in the bucket.
```

_See code: [src/cli/bucket/sync.js](https://github.com/railslove/roadtrip/blob/v1.1.0/src/cli/bucket/sync.js)_

## `roadtrip bucket:website`

configures the s3 bucket as website

```
USAGE
  $ roadtrip bucket:website

OPTIONS
  -c, --config=config  [default: roadtrip.json] path to a roadtrip configuration file
  -d, --domain=domain  custom domain for cloudfront
  -n, --name=name      name of the project
  --[no-]https         set up the site with https
  --verbose            turn on verbose output
```

_See code: [src/cli/bucket/website.js](https://github.com/railslove/roadtrip/blob/v1.1.0/src/cli/bucket/website.js)_

## `roadtrip distribution:create`

create cloudfront for project

```
USAGE
  $ roadtrip distribution:create

OPTIONS
  -c, --config=config  [default: roadtrip.json] path to a roadtrip configuration file
  -d, --domain=domain  custom domain for cloudfront
  -n, --name=name      name of the project
  --[no-]https         set up the site with https
  --verbose            turn on verbose output

DESCRIPTION
  Creates a distribution and connects it to the S3 bucket of the site. If the distribution already exists, the
  configuration will be updated.
  It looks for a matching certificate in the Certificate Manager. If no Certificate is found, it exits with an error.
```

_See code: [src/cli/distribution/create.js](https://github.com/railslove/roadtrip/blob/v1.1.0/src/cli/distribution/create.js)_

## `roadtrip distribution:invalidate`

invalidates the distribution's cache

```
USAGE
  $ roadtrip distribution:invalidate

OPTIONS
  -c, --config=config  [default: roadtrip.json] path to a roadtrip configuration file
  -d, --domain=domain  custom domain for cloudfront
  -n, --name=name      name of the project
  --[no-]https         set up the site with https
  --verbose            turn on verbose output
```

_See code: [src/cli/distribution/invalidate.js](https://github.com/railslove/roadtrip/blob/v1.1.0/src/cli/distribution/invalidate.js)_

## `roadtrip domain:connect ALIAS`

connect a custom domain to the project

```
USAGE
  $ roadtrip domain:connect ALIAS

ARGUMENTS
  ALIAS  alias domain to add as CNAME record, e.g. cloudfront the domain

OPTIONS
  -c, --config=config  [default: roadtrip.json] path to a roadtrip configuration file
  -d, --domain=domain  custom domain for cloudfront
  -n, --name=name      name of the project
  --[no-]https         set up the site with https
  --verbose            turn on verbose output

DESCRIPTION
  Creates a record pointing to the CloudFront URL as an alias. If the record doesn't exist or the alias is wrong, it
  will be updated.
```

_See code: [src/cli/domain/connect.js](https://github.com/railslove/roadtrip/blob/v1.1.0/src/cli/domain/connect.js)_

## `roadtrip help [COMMAND]`

display help for roadtrip

```
USAGE
  $ roadtrip help [COMMAND]

ARGUMENTS
  COMMAND  command to show help for

OPTIONS
  --all  see all commands in CLI
```

_See code: [@oclif/plugin-help](https://github.com/oclif/plugin-help/blob/v2.2.0/src/commands/help.ts)_

## `roadtrip project:deploy`

deploys the project

```
USAGE
  $ roadtrip project:deploy

OPTIONS
  -c, --config=config  [default: roadtrip.json] path to a roadtrip configuration file
  -d, --domain=domain  custom domain for cloudfront
  -n, --name=name      name of the project
  --connectDomain      also connect domain on route53
  --[no-]https         set up the site with https
  --skipCDN            skip creating cloudfront cdn
  --verbose            turn on verbose output

DESCRIPTION
  Creates a bucket and uploads files onto it. Creates and configures a CloudFront distribution and links it to your
  domain.
  This task is idempotent. You can run it again to update the site.
```

_See code: [src/cli/project/deploy.js](https://github.com/railslove/roadtrip/blob/v1.1.0/src/cli/project/deploy.js)_

## `roadtrip update [CHANNEL]`

update the roadtrip CLI

```
USAGE
  $ roadtrip update [CHANNEL]
```

_See code: [@oclif/plugin-update](https://github.com/oclif/plugin-update/blob/v1.3.9/src/commands/update.ts)_

<!-- commandsstop -->

# Alternatives

- https://github.com/brandonweiss/discharge/

# License

MIT © [Railslove](https://railslove.com)

![railslove](https://github.com/timomeh/roadtrip/raw/master/.github/logo-railslove.png)

<p align="center">
  Made with 💚 in Cologne
</p>
