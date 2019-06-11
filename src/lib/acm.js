import AWS from 'aws-sdk'

const acm = new AWS.ACM({ apiVersion: '2015-12-08' })

export async function getCertificateForDomain(domain) {
  const data = await acm
    .listCertificates({
      CertificateStatuses: ['PENDING_VALIDATION', 'ISSUED']
    })
    .promise()

  // Get all certificates which match the domainName
  const [tld, sld] = domain.split('.').reverse()
  const matchingCerts = data.CertificateSummaryList.filter(cert =>
    cert.DomainName.endsWith(`${sld}.${tld}`)
  )

  // Get all data of those certificates
  const allCertData = await Promise.all(
    matchingCerts.map(({ CertificateArn }) =>
      acm.describeCertificate({ CertificateArn }).promise()
    )
  )

  // Filter only the certificates which really work with the given site name.
  // Either the certificate's names include the domain directly, or it
  // includes a wildcard. Wildcards only are valid for one level.
  // (e.g. *.baz.com doesn't work for foo.baz.baz.com)
  const certMatches = allCertData.filter(certData => {
    // Strip the first path of the domain in order to check against
    // wildcard certificates. e.g. foo.bar.baz.io => bar.baz.io
    const [_subdomain, ...otherDomainParts] = domain.split('.')
    const domainForWildcardMatching = otherDomainParts.join('.')

    for (let name of certData.Certificate.SubjectAlternativeNames) {
      // direct match
      if (name === domain) return true

      // wildcard match
      if (name.replace('*.', '') === domainForWildcardMatching) return true

      // no match
      return false
    }
  })

  // No certificate found.
  if (certMatches.length < 1) return null

  // Sort all matching certificates by their IssuedAt date, choose the most
  // recent certificate.

  const certSortedByIssuedDate = certMatches.sort(
    (a, b) => b.Certificate.IssuedAt - a.Certificate.IssuedAt
  )

  return certSortedByIssuedDate[0].Certificate
}
