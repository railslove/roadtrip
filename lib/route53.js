import AWS from 'aws-sdk'

const r53 = new AWS.CloudFront({ apiVersion: '2013-04-01' })

export async function exists(domain, alias) {
  const zoneId = await getZoneId(domain)
  const record = await getRecord(zoneId, domain)
  return record && record.AliasTarget && record.AliasTarget.DNSName === alias
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
              HostedZoneId: 'Z2FDTNDATAQYW2' // Hosted Zone ID for CloudFront is some hardcoded thing according to the aws docs
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
      StartRecordType: 'A'
    })
    .promise()

  if (
    !data.ResourceRecordSets ||
    data.ResourceRecordSets.length < 1 ||
    !data.ResourceRecordSets[0].Name.includes(domain)
  ) {
    return undefined
  }

  return data.ResourceRecordSets[0]
}

async function getZoneId(domain) {
  const [tld, sld] = domain.split('.').reverse()
  const dnsName = `${sld}.${tld}`

  const data = await r53.listHostedZonesByName({ DNSName: dnsName }).promise()

  if (!data.HostedZones || data.HostedZones.length < 1) {
    throw new Error('No hosted zone found on aws for dns name: ' + dnsName)
  }

  return data.HostedZones[0].Id
}
