function initialise(parameters, requestor) {

    const request = requestor(2, e => {
        const company = e.config.passthrough.companyNumber
        if (e.response.status === 404) return `Could not find company ${company}`
        if (e.response.status === 429) return 'The rate limit has been reached'
        if (e.response.status === 401) return `API key ${e.config.auth.username} is invalid`
        if (e.response.status >= 400) return `Received code ${e.response.status} for company ${company}`
    })

    function locate(entry) {
        const companyNumber = entry[parameters.companyNumberField || 'companyNumber']
        if (!companyNumber) throw new Error('No company number found')
        const url = `https://api.companieshouse.gov.uk/company`
            + '/' + companyNumber.trim()
            + '/officers'
        return {
            url,
            auth: {
                username: parameters.apiKey,
                password: ''
            },
            params: {
                items_per_page: 100
            },
            passthrough: {
                companyNumber
            }
        }
    }

    async function paginate(response) {
        if (response.data.total_results > 100) {
            const pageTotal = Math.ceil(response.data.total_results / 100)
            const pageNumbers = Array.from(Array(pageTotal).keys()).slice(1) // slice off first page as we already have that
            const pageRequests = pageNumbers.map(async page => {
                const query = {
                    url: response.url,
                    auth: {
                        username: parameters.apiKey,
                        password: ''
                    },
                    params: {
                        items_per_page: 100,
                        start_index: page * 100
                    },
                    passthrough: {
                        companyNumber: response.passthrough.companyNumber
                    }
                }
                return request(query)
            })
            const pageResponses = await Promise.all(pageRequests)
            return [response].concat(pageResponses)
        }
        else return [response]
    }

    function parse(response) {
        const officers = response.data.items
        return officers.map(officer => {
            const fields = {
                officerName: officer.name,
                officerRole: officer.officer_role,
                officerAppointedDate: officer.appointed_on,
                officerResignedDate: officer.resigned_on,
                officerNationality: officer.nationality,
                officerOccupation: officer.occupation,
                officerAddress: officer.address ? [officer.address.care_of, officer.address.premises, officer.address.po_box, officer.address.address_line_1, officer.address.address_line_2, officer.address.locality, officer.address.region, officer.address.postal_code, officer.address.country].filter(x => x).join(', ') : null,
                officerDateOfBirth: officer.date_of_birth ? [officer.date_of_birth.year, officer.date_of_birth.month, officer.date_of_birth.day].filter(x => x).join('-') : null,
                officerCountryOfResidence: officer.country_of_residence,
                officerFormerNames: officer.former_names ? officer.former_names.map(name => [name.surname, name.forenames].filter(name => !['NONE', 'NONE NONE', 'N/A', 'N/A N/A', undefined].includes(name)).join(', ')).filter(x => x.length).join('; ') : null,
                officerIDType: officer.identification && officer.identification.identification_type ? officer.identification.identification_type : null,
                officerIDLegalAuthority: officer.identification && officer.identification.legal_authority ? officer.identification.legal_authority : null,
                officerIDLegalForm: officer.identification && officer.identification.legal_form ? officer.identification.legal_form : null,
                officerIDRegisteredPlace: officer.identification && officer.identification.place_registered ? officer.identification.place_registered : null,
                officerIDNumber: officer.identification && officer.identification.registration_number ? officer.identification.registration_number : null
            }
            return fields
        })
    }

    async function run(input) {
        const dataLocated = locate(input)
        const dataLocatedRequested = await request(dataLocated)
        const dataLocatedPaginated = await paginate(dataLocatedRequested)
        const dataParsed = dataLocatedPaginated.flatMap(parse)
        return dataParsed
    }

    return run

}

const details = {
    parameters: [
        { name: 'apiKey', description: 'A Companies House API key.' },
        { name: 'companyNumberField', description: 'Company number column. [optional, default: "companyNumber"]' }
    ],
    columns: [
        { name: 'officerName' },
        { name: 'officerRole' },
        { name: 'officerAppointedDate' },
        { name: 'officerResignedDate' },
        { name: 'officerNationality' },
        { name: 'officerOccupation' },
        { name: 'officerAddress' },
        { name: 'officerDateOfBirth' },
        { name: 'officerCountryOfResidence' },
        { name: 'officerFormerNames' },
        { name: 'officerIDType' },
        { name: 'officerIDLegalAuthority' },
        { name: 'officerIDLegalForm' },
        { name: 'officerIDRegisteredPlace' },
        { name: 'officerIDNumber' }
    ]
}

module.exports = { initialise, details }