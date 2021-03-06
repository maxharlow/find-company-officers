function initialise(parameters, requestor, die) {

    const request = requestor(2, e => {
        const company = e.config.passthrough.companyName
        if (e.response.status === 404) return `Could not find company ${company}`
        if (e.response.status === 429) die('The rate limit has been reached')
        if (e.response.status === 401) die(`API key ${e.config.auth.username} is invalid`)
        if (e.response.status >= 400) return `Received code ${e.response.status} for company ${company}`
    })

    function locate(entry) {
        const companyName = entry[parameters.companyNameField]
        if (!companyName) throw new Error('No company name found')
        return {
            url: 'https://api.company-information.service.gov.uk/search/companies',
            auth: {
                username: parameters.apiKey,
                password: ''
            },
            params: {
                q: companyName,
                items_per_page: 100 // as there's a bug in their API where giving 1 produces zero results when there is only one match
            },
            passthrough: {
                companyName
            }
        }
    }

    function parse(response) {
        const maximumResults = parameters.maximumResults || 1
        const companies = response.data.items
        return companies.slice(0, maximumResults).map(company => {
            const fields = {
                companyNumber: company.company_number,
                companyName: company.title
            }
            return fields
        })
    }

    async function run(input) {
        const dataLocated = locate(input)
        const dataLocatedRequested = await request(dataLocated)
        const dataParsed = parse(dataLocatedRequested)
        return dataParsed
    }

    return run

}

const details = {
    parameters: [
        { name: 'apiKey', description: 'A Companies House API key.' },
        { name: 'companyNameField', description: 'Company name column.' },
        { name: 'maximumResults', description: 'Maximum number of results to include for each name. [optional, default: 1, maximum 100]' }
    ],
    columns: [
        { name: 'companyNumber' },
        { name: 'companyName' }
    ]
}

export default { initialise, details }
