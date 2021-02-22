const core = require( '@actions/core' );

const {
  CodeartifactClient,
  GetAuthorizationTokenCommand,
  GetRepositoryEndpointCommand,
} = require( '@aws-sdk/client-codeartifact' );

const {
  STSClient,
  AssumeRoleCommand
} = require( '@aws-sdk/client-codeartifact' );


async function getCredentialsAsync( roleArn ) {

  if( !roleArn ) {
    return null;
  }

  const sts = new STSClient();

  const credentials = await sts.send(
    new AssumeRoleCommand( {
      roleArn: roleArn,
      roleSessionName: 'codeartifact',
      durationSeconds: 900
    } )
  );

  return credentials;
}

async function run() {
  try {
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

    const repository = core.getInput(
      'repository',
      { required: true } 
    );

    const repositoryEndpointFormat = core.getInput(
      'repository-endpoint-format',
      { required: true } 
    );

    const roleArn = core.getInput(
      'role-arn',
      { required: false }
    );

    const credentials = await getCredentialsAsync( roleArn );

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

    const repositoryEndpointP  = codeartifact.send(
      new GetRepositoryEndpointCommand( {
        domain: domain,
        repository: repository,
        format: repositoryEndpointFormat
      } )
    );

    const authTokenResp = await authTokenP;
    core.setOutput( 'authorization-token', authTokenResp.authorizationToken );

    const repositoryEndpointResp = await repositoryEndpointP;
    core.setOutput( 'repository-endpoint', repositoryEndpointResp.repositoryEndpoint );

  } catch( error ) {
    core.setFailed( error.message );
  }
}

run();
