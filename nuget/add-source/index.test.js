const action = require( './' );
const { readFile } = require( 'fs' ).promises;
const nock = require( 'nock' );
const { v4: uuidv4 } = require( 'uuid' );

const awsRegion = 'us-east-1';
const domain = 'd2l';
const repository = 'private';
const authorizationToken = 'TTTTTTTTTT';
const repositoryEndpoint = 'https://nuget.test.org/';

const codeartifactEndpoint = 'https://codeartifact.us-east-1.amazonaws.com';
const stsEndpoint = 'https://sts.us-east-1.amazonaws.com';
const nockOptions = Object.freeze( { allowUnmocked: false } );

beforeEach( () => {

	nock( codeartifactEndpoint, nockOptions )
		.get( '/_nock' )
		.reply( 200, 'OK!' );

	nock( stsEndpoint, nockOptions )
		.get( '/_nock' )
		.reply( 200, 'OK!' );
});

afterEach( () => {
	nock.cleanAll();
} );

test( 'run with environment crecentials', async () => {

	const configPath = `tmp/${uuidv4()}.nuget.config`;

	process.env = {
		AWS_ACCESS_KEY_ID: 'AAAA1111',
		AWS_SECRET_ACCESS_KEY: 'KKKK1111',
		'INPUT_AUTH-TOKEN-DURATION-SECONDS': '1800',
		'INPUT_AWS-REGION': awsRegion,
		INPUT_DOMAIN: domain,
		INPUT_REPOSITORY: repository,
		'INPUT_NUGET-CONFIG-PATH': configPath,
	};

	const getAuthTokenRequest = nock( codeartifactEndpoint, nockOptions )
		.post( '/v1/authorization-token?domain=d2l&duration=1800' )
		.reply( 200, {
			authorizationToken: authorizationToken,
			expiration: 1614024177
		} );

	const getRepostitoryEndpointRequest = nock( codeartifactEndpoint, nockOptions )
	.get( '/v1/repository/endpoint?domain=d2l&format=nuget&repository=private' )
	.reply( 200, {
		repositoryEndpoint: repositoryEndpoint
	} );

	await action();

	getAuthTokenRequest.done();
	getRepostitoryEndpointRequest.done();

	const config = await readFile( configPath, { encoding: 'utf8' } );

	const expectedConfig = `\uFEFF<?xml version="1.0" encoding="utf-8"?>
<configuration>
  <packageSources>
    <add key="${domain}/${repository}" value="${repositoryEndpoint}v3/index.json" />
  </packageSources>
  <packageSourceCredentials>
    <d2l_x002F_private>
        <add key="Username" value="aws" />
        <add key="ClearTextPassword" value="${authorizationToken}" />
      </d2l_x002F_private>
  </packageSourceCredentials>
</configuration>`;

	expect( config ).toEqual( expectedConfig );
} );

test( 'run with role arn', async () => {

		const configPath = `tmp/${uuidv4()}.nuget.config`;
		const roleArn = "arn:aws:iam::111111111111:role/test";

		process.env = {
			AWS_ACCESS_KEY_ID: 'AAAA1111',
			AWS_SECRET_ACCESS_KEY: 'KKKK1111',
			'INPUT_AUTH-TOKEN-DURATION-SECONDS': '1800',
			'INPUT_AWS-REGION': awsRegion,
			INPUT_DOMAIN: domain,
			INPUT_REPOSITORY: repository,
			'INPUT_ROLE-ARN': roleArn,
			'INPUT_NUGET-CONFIG-PATH': configPath,
		};

		let assumeRoleRequestBody = null;
		const assumeRoleRequest = nock( stsEndpoint, nockOptions )
			.post( '/', body => {
				assumeRoleRequestBody = body;
				return true;
			} )
			.reply( 200, `
<AssumeRoleResponse xmlns="https://sts.amazonaws.com/doc/2011-06-15/">
	<AssumeRoleResult>
		<AssumedRoleUser>
			<AssumedRoleId>AAAA:test</AssumedRoleId>
			<Arn>arn:aws:sts::111111111111:assumed-role/test/codeartifact</Arn>
		</AssumedRoleUser>
		<Credentials>
			<AccessKeyId>AAAA2222</AccessKeyId>
			<SecretAccessKey>BBBB2222</SecretAccessKey>
			<SessionToken>TTTT2222</SessionToken>
			<Expiration>2021-02-23T00:18:11Z</Expiration>
		</Credentials>
	</AssumeRoleResult>
	<ResponseMetadata>
		<RequestId>80d945a7-fc9c-4911-b2f2-59a2fae05643</RequestId>
	</ResponseMetadata>
</AssumeRoleResponse> ` );

		const assumedRoleNockOptions = Object.assign(
			{
				reqheaders: {
					'Authorization': val => {
						return val.includes( 'AAAA2222' );
					}
				}
			},
			nockOptions
		);

		const getAuthTokenRequest = nock( codeartifactEndpoint, assumedRoleNockOptions )
			.post( '/v1/authorization-token?domain=d2l&duration=1800' )
			.reply( 200, {
				authorizationToken: authorizationToken,
				expiration: 1614024177
			} );

		const getRepostitoryEndpointRequest = nock( codeartifactEndpoint, assumedRoleNockOptions )
		.get( '/v1/repository/endpoint?domain=d2l&format=nuget&repository=private' )
		.reply( 200, {
			repositoryEndpoint: repositoryEndpoint
		} );

		await action();

		assumeRoleRequest.done();
		getAuthTokenRequest.done();
		getRepostitoryEndpointRequest.done();

		expect( assumeRoleRequestBody ).toEqual( {
			Action: 'AssumeRole',
			DurationSeconds: '900',
			RoleArn: roleArn,
			RoleSessionName: 'codeartifact',
			Version: '2011-06-15'
		} );

		const config = await readFile( configPath, { encoding: 'utf8' } );

		const expectedConfig = `\uFEFF<?xml version="1.0" encoding="utf-8"?>
<configuration>
  <packageSources>
    <add key="${domain}/${repository}" value="${repositoryEndpoint}v3/index.json" />
  </packageSources>
  <packageSourceCredentials>
    <d2l_x002F_private>
        <add key="Username" value="aws" />
        <add key="ClearTextPassword" value="${authorizationToken}" />
      </d2l_x002F_private>
  </packageSourceCredentials>
</configuration>`;

		expect( config ).toEqual( expectedConfig );
	} );
