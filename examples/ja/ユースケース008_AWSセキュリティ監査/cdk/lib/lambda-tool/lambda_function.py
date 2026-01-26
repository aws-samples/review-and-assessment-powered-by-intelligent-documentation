import json
import logging
import subprocess
import os
from typing import Any, Dict

# ログ設定
logger = logging.getLogger()
logger.setLevel(os.getenv('LOG_LEVEL', 'INFO'))

def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Lambda handler for MCP tool proxy

    AgentCore Gateway sends tool parameters directly without toolName.
    Detect tool type based on parameter keys:
    - 'command' → call_aws
    - 'query' → suggest_aws_commands
    - 'task' → get_execution_plan
    """
    logger.info(f'Lambda invoked with event: {json.dumps(event)}')

    try:
        # Detect tool type from event parameters
        if 'command' in event:
            return handle_call_aws(event)
        elif 'query' in event:
            return handle_suggest_commands(event)
        elif 'task' in event:
            return handle_execution_plan(event)
        else:
            logger.error(f'Unknown event format: {event}')
            return {
                'content': [{'type': 'text', 'text': f'Error: Unknown event format. Expected "command", "query", or "task" parameter.'}],
                'isError': True
            }

    except Exception as e:
        logger.error(f'Unexpected error: {str(e)}', exc_info=True)
        return {
            'content': [{'type': 'text', 'text': f'Error: {str(e)}'}],
            'isError': True
        }

def handle_call_aws(tool_input: Dict[str, Any]) -> Dict[str, Any]:
    """Execute AWS CLI command"""
    command = tool_input.get('command', '')

    if not command:
        return {
            'content': [{'type': 'text', 'text': 'Error: command parameter is required'}],
            'isError': True
        }

    logger.info(f'Executing AWS CLI command: {command}')

    try:
        # Execute command directly
        result = subprocess.run(
            command,
            shell=True,
            capture_output=True,
            text=True,
            timeout=100,
            env={
                **os.environ,
                'HOME': '/tmp',
            }
        )

        # Combine stdout and stderr
        output = result.stdout
        if result.stderr:
            output += f"\n\nStderr:\n{result.stderr}"

        if result.returncode != 0:
            logger.warning(f'Command failed with return code {result.returncode}')
            return {
                'content': [{'type': 'text', 'text': f'Command failed (exit code {result.returncode}):\n{output}'}],
                'isError': True
            }

        logger.info('Command executed successfully')
        return {
            'content': [{'type': 'text', 'text': output}],
            'isError': False
        }

    except subprocess.TimeoutExpired:
        logger.error('Command timeout')
        return {
            'content': [{'type': 'text', 'text': 'Error: Command execution timeout'}],
            'isError': True
        }
    except Exception as e:
        logger.error(f'Command execution error: {str(e)}', exc_info=True)
        return {
            'content': [{'type': 'text', 'text': f'Error: {str(e)}'}],
            'isError': True
        }

def handle_suggest_commands(tool_input: Dict[str, Any]) -> Dict[str, Any]:
    """Suggest AWS CLI commands based on natural language query"""
    query = tool_input.get('query', '')

    if not query:
        return {
            'content': [{'type': 'text', 'text': 'Error: query parameter is required'}],
            'isError': True
        }

    logger.info(f'Suggesting commands for query: {query}')

    # Simple pattern matching for common queries
    suggestions = []

    query_lower = query.lower()

    if 's3' in query_lower and 'list' in query_lower:
        suggestions.append('aws s3 ls')
        suggestions.append('aws s3api list-buckets')
    elif 'rds' in query_lower:
        suggestions.append('aws rds describe-db-instances')
        suggestions.append('aws rds describe-db-snapshots')
    elif 'iam' in query_lower and 'user' in query_lower:
        suggestions.append('aws iam list-users')
        suggestions.append('aws iam get-user --user-name <username>')
    elif 'cloudtrail' in query_lower:
        suggestions.append('aws cloudtrail describe-trails')
        suggestions.append('aws cloudtrail lookup-events --max-results 10')
    elif 'ec2' in query_lower and 'instance' in query_lower:
        suggestions.append('aws ec2 describe-instances')
        suggestions.append('aws ec2 describe-security-groups')
    else:
        suggestions.append('aws help')
        suggestions.append(f'# No specific suggestions for: {query}')

    result_text = f"Suggested AWS CLI commands for '{query}':\n\n"
    result_text += '\n'.join(f'{i+1}. {cmd}' for i, cmd in enumerate(suggestions))

    return {
        'content': [{'type': 'text', 'text': result_text}],
        'isError': False
    }

def handle_execution_plan(tool_input: Dict[str, Any]) -> Dict[str, Any]:
    """Generate execution plan for complex AWS tasks"""
    task = tool_input.get('task', '')

    if not task:
        return {
            'content': [{'type': 'text', 'text': 'Error: task parameter is required'}],
            'isError': True
        }

    logger.info(f'Generating execution plan for task: {task}')

    # Simple workflow generation
    plan = f"""Execution Plan for: {task}

This is an experimental feature. For complex AWS tasks, consider:

1. Break down the task into smaller steps
2. Use AWS CLI commands for each step
3. Verify results between steps
4. Handle errors appropriately

Example workflow:
- Step 1: Gather information (describe-* commands)
- Step 2: Analyze requirements
- Step 3: Execute changes (create/update/delete commands)
- Step 4: Verify results

Use the 'call_aws' tool to execute individual AWS CLI commands for each step.
"""

    return {
        'content': [{'type': 'text', 'text': plan}],
        'isError': False
    }
