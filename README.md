![roadtrip](https://github.com/timomeh/roadtrip/raw/master/.github/banner.png)

Roadtrip is a CLI Tool to deploy and host static sites on AWS S3 and CloudFront,
and manage DNS records using Route53 (optional).

<!-- toc -->

- [💡 How it works](#-how-it-works)
- [🏎 Quick Start](#-quick-start)
- [👩‍💻 Install & Deploy](#-install--deploy)
- [📝 Project Configuration File](#-project-configuration-file)
- [🔭 Branch Previews](#-branch-previews)
- [🔨 Commands](#-commands)
- [Alternatives](#alternatives)
- [License](#license)
  <!-- tocstop -->

# 💡 How it works

Roadtrip uploads your website's files to an S3 bucket and configures it as a
static website. On your first deploy, it creates a CloudFront Distribution (CDN)
which serves files from the S3 bucket. This will make your website load much
faster, and allows you to use https (which isn't supported by S3's website hosting).
CloudFront takes ~10 minutes to roll out the new distribution.

Optionally Roadtrip will also create a dns alias record in Route53. If you don't
manage your nameserver through Route53, you can create a CNAME manually

The files on the CloudFront's servers will be cached for 1 year. If you deploy
changes, Roadtrip will invalidate those caches, causing CloudFront to fetch the
new version of your site.

# 🏎 Quick Start

```
$ npm i -g roadtrip-cli

$ roadtrip project deploy
✔ Create bucket
✔ Make bucket a website
✔ Synced 21 files
✔ Create distribution
↓ Invalidate paths on CDN [skipped]
  → The distribution was just created. No paths to invalidate.
✔ Create dns entry
Note: The distribution was just set up. It can take up to 10-20 minutes to be fully available.

URL of your distribution:
  https://a21xi98r7tykj.cloudfront.net
URL of your page:
  https://example.com
```

# 👩‍💻 Install & Deploy

### 0. Before your first deploy

- Create a certificate for your domain inside your AWS Console's Certificate Manager.
  You can use a wildcard certificate, e.g. for different environments on subdomains.
  Remember that a wildcard is only valid for one domain level.  
  Example: `*.example.com` works with `foo.example.com`, but not with `foo.bar.example.com`

- Create a hosted zone for your domain in AWS Route53. Roadtrip will create new
  DNS records inside this hosted zone.

### 1. Setup AWS Credentials

Create an API user in AWS's IAM Console with access to S3, CloudFront, ACM and Route53.
(TODO: provide policy config)

Add the credentials to the machine where you're deploying from:

- You can use `~/.aws/credentials` and set the environment variable `AWS_PROFILE=your_profile_name`.
- You can use the environment variables `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` and `AWS_DEFAULT_REGION`

Read more here: https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-envvars.html

### 2. Install Roadtrip

```
$ npm i -g roadtrip
```

### 3. Add a `roadtrip.json` to your project

```json
{
  "site": "example.com",
  "dir": "./build"
}
```

### 4. Deploy

Run `project deploy` inside your project directory to deploy and configure everything.

```
$ roadtrip project deploy
```

# 📝 Project Configuration File

Put a `roadtrip.json` in the root of your project.

Example:

```json
{
  "site": "example.com",
  "dir": "./build",
  "indexFile": "index.html",
  "errorFile": "index.html"
}
```

#### site

(required)  
The Domain of your page. This will be the bucket's name and added as alias to CloudFront.

#### dir

(default: `.`)  
The directory to deploy to S3.

#### indexFile

(default: `index.html`)  
The file which will act as index page.

#### errorFile

(default: `404.html`)  
The file which will act as 404 page.

# 🔭 Branch Previews

You can also use Roadtrip to create preview environments of a branch, simply by
overriding the domain with the `--site` flag.

```sh
$ roadtrip project deploy --site=preview-${BRANCH_NAME}.example.foo
```

Keep in mind that CloudFront needs ~10 minutes to roll out new distributions, so
your branch preview won't be available immediately.  
If you want a preview without this delay, you could have some environments
already rolled out, e.g. `preview-01` and `preview-02`, and use those as
deployment targets.

This even works if you don't use Route53: CloudFront returns a publicly
available URL with a valid certificate. The URL won't be pretty, but it'll work.

# 🔨 Commands

<!-- commands -->

- [`roadtrip bucket ACTION`](#roadtrip-bucket-action)
- [`roadtrip distribution ACTION`](#roadtrip-distribution-action)
- [`roadtrip domain ACTION`](#roadtrip-domain-action)
- [`roadtrip help [COMMAND]`](#roadtrip-help-command)
- [`roadtrip project ACTION`](#roadtrip-project-action)

## `roadtrip bucket ACTION`

manage the s3 bucket for a site

```
USAGE
  $ roadtrip bucket ACTION

ARGUMENTS
  ACTION  (create|website|sync|setup) action to be performed on the bucket

OPTIONS
  -c, --config=config    [default: roadtrip.json] path to a roadtrip configuration file
  -d, --dir=dir          [default: .] path to the directory which is synced to the bucket
  -s, --site=site        domain name under which the site will be available
  --errorFile=errorFile  [default: 404.html] name of the file for 404 Not Found errors
  --indexFile=indexFile  [default: index.html] name of the file which acts as index page

DESCRIPTION
  Performs actions related to the S3 bucket.

  create:
  Creates a bucket with the name of the site. Does nothing if the bucket already exists.

  website:
  Configures the bucket as a static website.

  sync:
  Syncs the files of the local directory to the bucket. Only syncs changed files. If a file exists on the bucket but not
  locally, the file will be deleted.

  setup:
  Runs create, website and sync consecutively.
```

## `roadtrip distribution ACTION`

manage the cloudfront distribution for a site

```
USAGE
  $ roadtrip distribution ACTION

ARGUMENTS
  ACTION  (create|invalidate|setup) action to be performed on the distribution

OPTIONS
  -c, --config=config  [default: roadtrip.json] path to a roadtrip configuration file
  -s, --site=site      domain name under which the site will be available

DESCRIPTION
  Performs actions related to the CloudFront distribution (CDN).

  create:
  Creates a distribution and connects it to the S3 bucket of the site. If the distribution already exists, the
  configuration will be updated.
  It looks for a matching certificate in the Certificate Manager. If no Certificate is found, it exits with an error.

  invalidate:
  Invalidates the cache on the distribution.

  setup:
  Runs create and invalidate consecutively.
```

## `roadtrip domain ACTION`

manage the domain and dns for a site

```
USAGE
  $ roadtrip domain ACTION

ARGUMENTS
  ACTION  (create) action to be performed on the hosted zone

OPTIONS
  -a, --alias=alias    (required)
  -c, --config=config  [default: roadtrip.json] path to a roadtrip configuration file
  -s, --site=site      domain name under which the site will be available

DESCRIPTION
  Performs actions realted to the DNS on Route53.

  create:
  Creates a record pointing to the CloudFront URL as an alias. If the record doesn't exist or the alias is wrong, it
  will be updated.
```

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

## `roadtrip project ACTION`

manage the roadtrip project

```
USAGE
  $ roadtrip project ACTION

ARGUMENTS
  ACTION  (deploy) actions to control the project

OPTIONS
  -c, --config=config    [default: roadtrip.json] path to a roadtrip configuration file
  -d, --dir=dir          [default: .] path to the directory which is synced to the bucket
  -s, --site=site        domain name under which the site will be available
  --errorFile=errorFile  [default: 404.html] name of the file for 404 Not Found errors
  --indexFile=indexFile  [default: index.html] name of the file which acts as index page

DESCRIPTION
  Perform all actions for your roadtrip project.

  deploy:
  Runs 'bucket setup', 'distribution setup' and 'domain create' consecutively.
  Creates a bucket and uploads files onto it. Then it creates and configures a CloudFront CDN and links it to your
  domain.
  This task is idempotent. You can run it again to update your site.
```

<!-- commandsstop -->

# Alternatives

- https://github.com/brandonweiss/discharge/

# License

MIT © [Railslove](https://railslove.com)

![railslove](https://github.com/timomeh/roadtrip/raw/master/.github/logo-railslove.png)

<p align="center">
  Made with 💚 in Cologne
</p>
