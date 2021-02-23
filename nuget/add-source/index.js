const core = require( '@actions/core' );
const { execFile } = require( 'child_process' );
const { writeFile } = require( 'fs' ).promises;

const {
	CodeartifactClient,
	GetAuthorizationTokenCommand,
	GetRepositoryEndpointCommand,
} = require( '@aws-sdk/client-codeartifact' );

const {
	STSClient,
	AssumeRoleCommand
} = require( '@aws-sdk/client-sts' );

function addNugetSource(
		configFile,
		domain,
		repository,
		authorizationToken,
		repositoryEndpoint
	) {

	const args = [
		'nuget',
		'add',
		'source',
		'--configfile',
		configFile,
		'--name',
		`${domain}/${repository}`,
		'--username',
		'aws',
		'--password',
		authorizationToken,
		'--store-password-in-clear-text',
		`${repositoryEndpoint}v3/index.json`,
	];

	return new Promise( ( resolve, reject ) => {

		execFile( 'dotnet', args, ( err, stdout, stderr ) => {

			if( stdout ) {
				console.log( stdout );
			}
			if( stderr ) {
				console.error( stderr );
			}

			if( err ) {
				reject( err );
			} else {
				resolve();
			}
		} );
	} );
}

async function createNugetConfig( path ) {

	try {
		await writeFile( path, '<configuration />', {
			flag: 'wx'
		} );

		console.log( `Created ${path}` );

	} catch( err ) {

		// ok if the file already exists
		if( err.code === 'EEXIST' ) {
			return;
		}

		throw err;
	}
}

async function getCredentialsAsync( awsRegion, roleArn ) {

	if( !roleArn ) {
		return null;
	}

	const sts = new STSClient( {
		region: awsRegion
	} );

	const resp = await sts.send(
		new AssumeRoleCommand( {
			RoleArn: roleArn,
			RoleSessionName: 'codeartifact',
			DurationSeconds: 900
		} )
	);

	const credentials = resp.Credentials;

	return {
		accessKeyId: credentials.AccessKeyId,
		secretAccessKey: credentials.SecretAccessKey,
		sessionToken: credentials.SessionToken,
		expiration: credentials.Expiration
	};
}

async function run() {

	const authTokenDurationSeconds = core.getInput(
		'auth-token-duration-seconds',
		{ required: true }
	);

	const awsRegion = core.getInput(
		'aws-region',
		{ required: true }
	);

	const domain = core.getInput(
		'domain',
		{ required: true }
	);

	const nugetConfigPath = core.getInput(
		'nuget-config-path',
		{ required: true }
	);

	const repository = core.getInput(
		'repository',
		{ required: true } 
	);

	const roleArn = core.getInput(
		'role-arn',
		{ required: false }
	);

	const credentials = await getCredentialsAsync(
		awsRegion,
		roleArn
	);

	const codeartifact = new CodeartifactClient( {
		credentials: credentials,
		region: awsRegion
	} );

	const authTokenP = codeartifact.send(
		new GetAuthorizationTokenCommand( {
			domain: domain,
			durationSeconds: parseInt( authTokenDurationSeconds )
		} )
	);

	const repositoryEndpointP = codeartifact.send(
		new GetRepositoryEndpointCommand( {
			domain: domain,
			repository: repository,
			format: 'nuget'
		} )
	);

	await createNugetConfig( nugetConfigPath );

	const resps = await Promise.all( [
		authTokenP,
		repositoryEndpointP
	] );

	const authorizationToken = resps[ 0 ].authorizationToken;
	const repositoryEndpoint = resps[ 1 ].repositoryEndpoint;
	
	await addNugetSource(
		nugetConfigPath,
		domain,
		repository,
		authorizationToken,
		repositoryEndpoint
	);
}

if ( require.main === module ) {
	run().catch( err => {
		core.setFailed( err );
	} );
}

module.exports = run;
