import AWS from 'aws-sdk'

const r53 = new AWS.Route53({ apiVersion: '2013-04-01' })

export async function exists(domain, alias) {
  const zoneId = await getZoneId(domain)
  const record = await getRecord(zoneId, domain)

  if (!record || !record.AliasTarget) return false

  // If a record exists but hasn't the correct alias, we assume it doesn't
  // exist. If the alias is wrong, `upsert` will fix it.
  return record.AliasTarget.DNSName.includes(alias)
}

export async function upsert(domain, alias) {
  const zoneId = await getZoneId(domain)

  const config = {
    HostedZoneId: zoneId,
    ChangeBatch: {
      Comment: `ALIAS for ${domain} to cloudfront, automated by roadtrip`,
      Changes: [
        {
          Action: 'UPSERT',
          ResourceRecordSet: {
            Name: domain,
            Type: 'A',
            AliasTarget: {
              DNSName: alias,
              EvaluateTargetHealth: false,
              HostedZoneId: 'Z2FDTNDATAQYW2' // Hosted Zone ID for CloudFront is some hardcoded thing. (ಠ_ಠ)
            }
          }
        }
      ]
    }
  }

  return r53.changeResourceRecordSets(config).promise()
}

async function getRecord(zoneId, domain) {
  const data = await r53
    .listResourceRecordSets({
      HostedZoneId: zoneId,
      StartRecordName: domain,
      StartRecordType: 'A' // this doesn't mean aws-sdk only returns A records. It just returns them first, if there are any.
    })
    .promise()

  // Check if results were returned and if an A record with that domain is set up.
  if (
    !data.ResourceRecordSets ||
    data.ResourceRecordSets.length < 1 ||
    !data.ResourceRecordSets[0].Name.includes(domain) ||
    data.ResourceRecordSets[0].Type !== 'A'
  ) {
    return undefined
  }

  return data.ResourceRecordSets[0]
}

// Get ID of hosted zone. The hosted zone's DNS name should be the domainName
// (second-level-domain.top-level-domain)
async function getZoneId(domain) {
  const [tld, sld] = domain.split('.').reverse()
  const dnsName = `${sld}.${tld}`

  const data = await r53.listHostedZonesByName({ DNSName: dnsName }).promise()

  if (!data.HostedZones || data.HostedZones.length < 1) {
    throw new Error('No hosted zone found on aws for dns name: ' + dnsName)
  }

  return data.HostedZones[0].Id
}
