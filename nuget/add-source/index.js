const core = require( '@actions/core' );
const { writeFile } = require( 'fs' ).promises;

const { promisify } = require( 'util' );
const execFile = promisify( require( 'child_process' ).execFile );

const {
  CodeartifactClient,
  GetAuthorizationTokenCommand,
  GetRepositoryEndpointCommand,
} = require( '@aws-sdk/client-codeartifact' );

const {
  STSClient,
  AssumeRoleCommand
} = require( '@aws-sdk/client-sts' );

async function addNugetSource(
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

  const { stdout } = await execFile( 'dotnet', args );
  console.log( stdout );
}

async function createNugetConfig( path ) {

  try {
    await writeFile( path, '<configuratiion />', {
      flag: 'wx'
    });

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

  const sts = new STSClient({
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

    const repositoryEndpointP  = codeartifact.send(
      new GetRepositoryEndpointCommand( {
        domain: domain,
        repository: repository,
        format: 'nuget'
      } )
    );

    await createNugetConfig( nugetConfigPath );

    const authTokenResp = await authTokenP;
    const repositoryEndpointResp = await repositoryEndpointP;

    await addNugetSource(
        nugetConfigPath,
        domain,
        repository,
        authTokenResp.authorizationToken,
        repositoryEndpointResp.repositoryEndpoint
    );

  } catch( error ) {
    core.setFailed( error.message );
  }
}

run();
