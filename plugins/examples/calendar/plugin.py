"""
Calendar Plugin

This plugin provides integration with Google Calendar and local calendar systems.
It allows viewing, creating, and updating calendar events.
"""

import os
import json
import datetime
import logging
import sys
from typing import Dict, Any, List, Optional, Union, Tuple, cast
from pathlib import Path

# Add the parent directory to the Python path
sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent))

# Import plugin base
from plugins.core.plugin_base import PluginBase
from plugins.utils.plugin_utils import create_action_schema, create_config_schema

logger = logging.getLogger(__name__)

# Try to import Google Calendar API
try:
    from googleapiclient.discovery import build
    from google_auth_oauthlib.flow import InstalledAppFlow
    from google.auth.transport.requests import Request
    from google.oauth2.credentials import Credentials
    HAS_GOOGLE_CALENDAR = True
except ImportError:
    logger.warning("Google Calendar API not available. Install with 'pip install google-api-python-client google-auth-httplib2 google-auth-oauthlib'")
    HAS_GOOGLE_CALENDAR = False

# Try to import icalendar for local calendar support
try:
    import icalendar
    HAS_ICALENDAR = True
except ImportError:
    logger.warning("icalendar package not available. Install with 'pip install icalendar'")
    HAS_ICALENDAR = False


class CalendarPlugin(PluginBase):
    """
    Calendar integration plugin.
    
    This plugin integrates with Google Calendar and local calendar systems,
    allowing the user to view, create, and update calendar events.
    """
    
    def __init__(self, plugin_id: str, config: Optional[Dict[str, Any]] = None):
        """Initialize the calendar plugin."""
        super().__init__(plugin_id, config)
        self.google_calendar_service = None
        self.token_path = None
        self.credentials_path = None
        self.calendar_type = None
        self.local_calendar_path = None
        self.scopes = ['https://www.googleapis.com/auth/calendar']
    
    def setup(self) -> bool:
        """Set up the calendar plugin."""
        try:
            # Determine calendar type
            self.calendar_type = self.config.get('calendar_type', 'google')
            
            if self.calendar_type == 'google':
                # Set up Google Calendar
                if not HAS_GOOGLE_CALENDAR:
                    self.error_message = "Google Calendar API not available"
                    return False
                
                # Set up paths
                plugin_dir = os.path.dirname(os.path.abspath(__file__))
                self.token_path = self.config.get('token_path', os.path.join(plugin_dir, 'token.json'))
                self.credentials_path = self.config.get('credentials_path', os.path.join(plugin_dir, 'credentials.json'))
                
                # Check if credentials file exists
                if not os.path.exists(self.credentials_path):
                    self.error_message = f"Google Calendar credentials file not found at {self.credentials_path}"
                    return False
                
                # Try to authenticate
                return self._authenticate_google()
                
            elif self.calendar_type == 'local':
                # Set up local calendar
                if not HAS_ICALENDAR:
                    self.error_message = "icalendar package not available"
                    return False
                
                # Set up local calendar path
                self.local_calendar_path = self.config.get('local_calendar_path')
                
                if not self.local_calendar_path:
                    self.error_message = "Local calendar path not specified"
                    return False
                
                if not os.path.exists(self.local_calendar_path):
                    self.error_message = f"Local calendar file not found at {self.local_calendar_path}"
                    return False
                
                return True
                
            elif self.calendar_type == 'mock':
                # Mock calendar for testing
                logger.info("Using mock calendar for testing")
                return True
                
            else:
                self.error_message = f"Unsupported calendar type: {self.calendar_type}"
                return False
                
        except Exception as e:
            self.error_message = f"Error setting up calendar plugin: {str(e)}"
            logger.error(f"Error setting up calendar plugin: {e}")
            return False
    
    def _authenticate_google(self) -> bool:
        """Authenticate with Google Calendar API."""
        try:
            creds = None
            
            # Check if token file exists
            if os.path.exists(self.token_path):
                creds = Credentials.from_authorized_user_info(
                    json.load(open(self.token_path)),
                    self.scopes
                )
            
            # If credentials don't exist or are invalid, ask for authentication
            if not creds or not creds.valid:
                if creds and creds.expired and creds.refresh_token:
                    creds.refresh(Request())
                else:
                    flow = InstalledAppFlow.from_client_secrets_file(self.credentials_path, self.scopes)
                    creds = flow.run_local_server(port=0)
                
                # Save the credentials for the next run
                with open(self.token_path, 'w') as token:
                    token.write(creds.to_json())
            
            # Build the service
            self.google_calendar_service = build('calendar', 'v3', credentials=creds)
            
            return True
        except Exception as e:
            self.error_message = f"Error authenticating with Google Calendar: {str(e)}"
            logger.error(f"Error authenticating with Google Calendar: {e}")
            return False
    
    def execute(self, action: str, parameters: Dict[str, Any]) -> Dict[str, Any]:
        """
        Execute a calendar action.
        
        Args:
            action: Action to perform
            parameters: Action parameters
            
        Returns:
            Action result
        """
        # Map actions to methods
        actions = {
            'list_events': self.list_events,
            'get_event': self.get_event,
            'create_event': self.create_event,
            'update_event': self.update_event,
            'delete_event': self.delete_event,
            'list_calendars': self.list_calendars,
            'get_availability': self.get_availability,
        }
        
        # Check if action exists
        if action not in actions:
            return {
                'success': False,
                'error': f"Unsupported action: {action}"
            }
        
        try:
            # Execute action
            result = actions[action](**parameters)
            return {
                'success': True,
                'result': result
            }
        except Exception as e:
            logger.error(f"Error executing calendar action {action}: {e}")
            return {
                'success': False,
                'error': f"Error executing calendar action: {str(e)}"
            }
    
    def unload(self) -> bool:
        """Unload the calendar plugin."""
        try:
            # Clean up any resources
            self.google_calendar_service = None
            return True
        except Exception as e:
            logger.error(f"Error unloading calendar plugin: {e}")
            return False
    
    def get_schema(self) -> Dict[str, Any]:
        """
        Get the configuration schema for the calendar plugin.
        
        Returns:
            Configuration schema
        """
        return create_config_schema(
            config_fields={
                'calendar_type': {
                    'type': 'string',
                    'enum': ['google', 'local', 'mock'],
                    'description': 'Type of calendar to use'
                },
                'credentials_path': {
                    'type': 'string',
                    'description': 'Path to Google Calendar API credentials file'
                },
                'token_path': {
                    'type': 'string',
                    'description': 'Path to save Google Calendar API token'
                },
                'local_calendar_path': {
                    'type': 'string',
                    'description': 'Path to local calendar file (ICS format)'
                },
                'default_calendar_id': {
                    'type': 'string',
                    'description': 'Default calendar ID to use (for Google Calendar)'
                }
            },
            required_fields=['calendar_type'],
            title='Calendar Plugin Configuration',
            description='Configuration for the calendar integration plugin'
        )
    
    def get_actions(self) -> Dict[str, Dict[str, Any]]:
        """
        Get available actions for the calendar plugin.
        
        Returns:
            Dictionary of actions and their schemas
        """
        return {
            'list_events': create_action_schema(
                name='list_events',
                description='List calendar events in a specific time range',
                parameters={
                    'start_time': {
                        'type': 'string',
                        'description': 'Start time in ISO format (YYYY-MM-DDTHH:MM:SS) or relative time (e.g., "today", "tomorrow")'
                    },
                    'end_time': {
                        'type': 'string',
                        'description': 'End time in ISO format (YYYY-MM-DDTHH:MM:SS) or relative time (e.g., "today", "tomorrow")'
                    },
                    'calendar_id': {
                        'type': 'string',
                        'description': 'Calendar ID (for Google Calendar)'
                    },
                    'max_results': {
                        'type': 'integer',
                        'description': 'Maximum number of events to return'
                    }
                },
                required=['start_time', 'end_time']
            ),
            'get_event': create_action_schema(
                name='get_event',
                description='Get details of a specific calendar event',
                parameters={
                    'event_id': {
                        'type': 'string',
                        'description': 'Event ID'
                    },
                    'calendar_id': {
                        'type': 'string',
                        'description': 'Calendar ID (for Google Calendar)'
                    }
                },
                required=['event_id']
            ),
            'create_event': create_action_schema(
                name='create_event',
                description='Create a new calendar event',
                parameters={
                    'summary': {
                        'type': 'string',
                        'description': 'Event summary/title'
                    },
                    'start_time': {
                        'type': 'string',
                        'description': 'Start time in ISO format (YYYY-MM-DDTHH:MM:SS) or relative time'
                    },
                    'end_time': {
                        'type': 'string',
                        'description': 'End time in ISO format (YYYY-MM-DDTHH:MM:SS) or relative time'
                    },
                    'description': {
                        'type': 'string',
                        'description': 'Event description'
                    },
                    'location': {
                        'type': 'string',
                        'description': 'Event location'
                    },
                    'calendar_id': {
                        'type': 'string',
                        'description': 'Calendar ID (for Google Calendar)'
                    },
                    'attendees': {
                        'type': 'array',
                        'items': {
                            'type': 'string'
                        },
                        'description': 'List of attendee email addresses'
                    }
                },
                required=['summary', 'start_time', 'end_time']
            ),
            'update_event': create_action_schema(
                name='update_event',
                description='Update an existing calendar event',
                parameters={
                    'event_id': {
                        'type': 'string',
                        'description': 'Event ID'
                    },
                    'summary': {
                        'type': 'string',
                        'description': 'Event summary/title'
                    },
                    'start_time': {
                        'type': 'string',
                        'description': 'Start time in ISO format (YYYY-MM-DDTHH:MM:SS) or relative time'
                    },
                    'end_time': {
                        'type': 'string',
                        'description': 'End time in ISO format (YYYY-MM-DDTHH:MM:SS) or relative time'
                    },
                    'description': {
                        'type': 'string',
                        'description': 'Event description'
                    },
                    'location': {
                        'type': 'string',
                        'description': 'Event location'
                    },
                    'calendar_id': {
                        'type': 'string',
                        'description': 'Calendar ID (for Google Calendar)'
                    },
                    'attendees': {
                        'type': 'array',
                        'items': {
                            'type': 'string'
                        },
                        'description': 'List of attendee email addresses'
                    }
                },
                required=['event_id']
            ),
            'delete_event': create_action_schema(
                name='delete_event',
                description='Delete a calendar event',
                parameters={
                    'event_id': {
                        'type': 'string',
                        'description': 'Event ID'
                    },
                    'calendar_id': {
                        'type': 'string',
                        'description': 'Calendar ID (for Google Calendar)'
                    }
                },
                required=['event_id']
            ),
            'list_calendars': create_action_schema(
                name='list_calendars',
                description='List available calendars',
                parameters={}
            ),
            'get_availability': create_action_schema(
                name='get_availability',
                description='Get free/busy information for a time range',
                parameters={
                    'start_time': {
                        'type': 'string',
                        'description': 'Start time in ISO format (YYYY-MM-DDTHH:MM:SS) or relative time'
                    },
                    'end_time': {
                        'type': 'string',
                        'description': 'End time in ISO format (YYYY-MM-DDTHH:MM:SS) or relative time'
                    },
                    'calendar_id': {
                        'type': 'string',
                        'description': 'Calendar ID (for Google Calendar)'
                    }
                },
                required=['start_time', 'end_time']
            )
        }
    
    def _parse_time(self, time_str: str) -> datetime.datetime:
        """
        Parse a time string into a datetime object.
        
        Args:
            time_str: Time string in ISO format or relative time
            
        Returns:
            Datetime object
        """
        # Handle relative times
        now = datetime.datetime.now()
        if time_str.lower() == 'today':
            return datetime.datetime(now.year, now.month, now.day, 0, 0, 0)
        elif time_str.lower() == 'tomorrow':
            tomorrow = now + datetime.timedelta(days=1)
            return datetime.datetime(tomorrow.year, tomorrow.month, tomorrow.day, 0, 0, 0)
        elif time_str.lower() == 'next_week':
            next_week = now + datetime.timedelta(days=7)
            return datetime.datetime(next_week.year, next_week.month, next_week.day, 0, 0, 0)
        elif time_str.lower() in ['now', 'current']:
            return now
        
        # Handle ISO format
        try:
            return datetime.datetime.fromisoformat(time_str)
        except ValueError:
            # Try different formats
            for fmt in ['%Y-%m-%d', '%Y/%m/%d', '%d/%m/%Y', '%m/%d/%Y']:
                try:
                    return datetime.datetime.strptime(time_str, fmt)
                except ValueError:
                    continue
            
            # If we get here, no format worked
            raise ValueError(f"Invalid time format: {time_str}")
    
    def _get_default_calendar_id(self) -> str:
        """
        Get the default calendar ID.
        
        Returns:
            Default calendar ID
        """
        if self.calendar_type == 'google':
            # Use configured default or 'primary'
            return self.config.get('default_calendar_id', 'primary')
        else:
            # For other types, just return a default value
            return 'default'
    
    def list_events(
        self,
        start_time: str,
        end_time: str,
        calendar_id: Optional[str] = None,
        max_results: int = 10
    ) -> List[Dict[str, Any]]:
        """
        List calendar events in a specific time range.
        
        Args:
            start_time: Start time in ISO format or relative time
            end_time: End time in ISO format or relative time
            calendar_id: Calendar ID (for Google Calendar)
            max_results: Maximum number of events to return
            
        Returns:
            List of events
        """
        # Parse times
        start_dt = self._parse_time(start_time)
        end_dt = self._parse_time(end_time)
        
        # Use default calendar if not specified
        if not calendar_id:
            calendar_id = self._get_default_calendar_id()
        
        if self.calendar_type == 'google':
            # Call Google Calendar API
            events_result = self.google_calendar_service.events().list(
                calendarId=calendar_id,
                timeMin=start_dt.isoformat() + 'Z',
                timeMax=end_dt.isoformat() + 'Z',
                maxResults=max_results,
                singleEvents=True,
                orderBy='startTime'
            ).execute()
            
            events = events_result.get('items', [])
            
            # Process events to standardize format
            return [
                {
                    'id': event.get('id'),
                    'summary': event.get('summary', 'Untitled Event'),
                    'start': event.get('start').get('dateTime', event.get('start').get('date')),
                    'end': event.get('end').get('dateTime', event.get('end').get('date')),
                    'description': event.get('description', ''),
                    'location': event.get('location', ''),
                    'creator': event.get('creator', {}).get('email', ''),
                    'attendees': [
                        attendee.get('email')
                        for attendee in event.get('attendees', [])
                    ],
                    'link': event.get('htmlLink', '')
                }
                for event in events
            ]
            
        elif self.calendar_type == 'local':
            # Parse local calendar file
            with open(self.local_calendar_path, 'rb') as f:
                cal = icalendar.Calendar.from_ical(f.read())
            
            events = []
            for component in cal.walk():
                if component.name == "VEVENT":
                    # Get event start and end times
                    event_start = component.get('dtstart').dt
                    event_end = component.get('dtend').dt
                    
                    # Convert to datetime if date
                    if isinstance(event_start, datetime.date) and not isinstance(event_start, datetime.datetime):
                        event_start = datetime.datetime.combine(event_start, datetime.time.min)
                    
                    if isinstance(event_end, datetime.date) and not isinstance(event_end, datetime.datetime):
                        event_end = datetime.datetime.combine(event_end, datetime.time.min)
                    
                    # Check if event is in range
                    if event_start >= start_dt and event_end <= end_dt:
                        events.append({
                            'id': str(component.get('uid')),
                            'summary': str(component.get('summary')),
                            'start': event_start.isoformat(),
                            'end': event_end.isoformat(),
                            'description': str(component.get('description', '')),
                            'location': str(component.get('location', '')),
                            'creator': '',  # Not available in ICS
                            'attendees': [],  # Not implemented for ICS
                            'link': ''  # Not available in ICS
                        })
                        
                        # Stop if we've reached max results
                        if len(events) >= max_results:
                            break
            
            return events
            
        elif self.calendar_type == 'mock':
            # Return mock data
            return [
                {
                    'id': '1',
                    'summary': 'Team Meeting',
                    'start': (start_dt + datetime.timedelta(hours=1)).isoformat(),
                    'end': (start_dt + datetime.timedelta(hours=2)).isoformat(),
                    'description': 'Weekly team sync-up',
                    'location': 'Conference Room A',
                    'creator': 'manager@example.com',
                    'attendees': ['employee1@example.com', 'employee2@example.com'],
                    'link': ''
                },
                {
                    'id': '2',
                    'summary': 'Project Deadline',
                    'start': (start_dt + datetime.timedelta(days=2)).isoformat(),
                    'end': (start_dt + datetime.timedelta(days=2, hours=1)).isoformat(),
                    'description': 'Final project submission',
                    'location': '',
                    'creator': 'manager@example.com',
                    'attendees': [],
                    'link': ''
                }
            ]
            
        else:
            raise ValueError(f"Unsupported calendar type: {self.calendar_type}")
    
    def get_event(
        self,
        event_id: str,
        calendar_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Get details of a specific calendar event.
        
        Args:
            event_id: Event ID
            calendar_id: Calendar ID (for Google Calendar)
            
        Returns:
            Event details
        """
        # Use default calendar if not specified
        if not calendar_id:
            calendar_id = self._get_default_calendar_id()
        
        if self.calendar_type == 'google':
            # Call Google Calendar API
            event = self.google_calendar_service.events().get(
                calendarId=calendar_id,
                eventId=event_id
            ).execute()
            
            # Process event to standardize format
            return {
                'id': event.get('id'),
                'summary': event.get('summary', 'Untitled Event'),
                'start': event.get('start').get('dateTime', event.get('start').get('date')),
                'end': event.get('end').get('dateTime', event.get('end').get('date')),
                'description': event.get('description', ''),
                'location': event.get('location', ''),
                'creator': event.get('creator', {}).get('email', ''),
                'attendees': [
                    attendee.get('email')
                    for attendee in event.get('attendees', [])
                ],
                'link': event.get('htmlLink', '')
            }
            
        elif self.calendar_type == 'local':
            # Parse local calendar file
            with open(self.local_calendar_path, 'rb') as f:
                cal = icalendar.Calendar.from_ical(f.read())
            
            for component in cal.walk():
                if component.name == "VEVENT":
                    # Check if this is the event we're looking for
                    if str(component.get('uid')) == event_id:
                        # Get event start and end times
                        event_start = component.get('dtstart').dt
                        event_end = component.get('dtend').dt
                        
                        # Convert to datetime if date
                        if isinstance(event_start, datetime.date) and not isinstance(event_start, datetime.datetime):
                            event_start = datetime.datetime.combine(event_start, datetime.time.min)
                        
                        if isinstance(event_end, datetime.date) and not isinstance(event_end, datetime.datetime):
                            event_end = datetime.datetime.combine(event_end, datetime.time.min)
                        
                        return {
                            'id': event_id,
                            'summary': str(component.get('summary')),
                            'start': event_start.isoformat(),
                            'end': event_end.isoformat(),
                            'description': str(component.get('description', '')),
                            'location': str(component.get('location', '')),
                            'creator': '',  # Not available in ICS
                            'attendees': [],  # Not implemented for ICS
                            'link': ''  # Not available in ICS
                        }
            
            # If we get here, event wasn't found
            raise ValueError(f"Event not found: {event_id}")
            
        elif self.calendar_type == 'mock':
            # Return mock data
            if event_id == '1':
                return {
                    'id': '1',
                    'summary': 'Team Meeting',
                    'start': '2023-04-15T10:00:00',
                    'end': '2023-04-15T11:00:00',
                    'description': 'Weekly team sync-up',
                    'location': 'Conference Room A',
                    'creator': 'manager@example.com',
                    'attendees': ['employee1@example.com', 'employee2@example.com'],
                    'link': ''
                }
            elif event_id == '2':
                return {
                    'id': '2',
                    'summary': 'Project Deadline',
                    'start': '2023-04-18T09:00:00',
                    'end': '2023-04-18T10:00:00',
                    'description': 'Final project submission',
                    'location': '',
                    'creator': 'manager@example.com',
                    'attendees': [],
                    'link': ''
                }
            else:
                raise ValueError(f"Event not found: {event_id}")
                
        else:
            raise ValueError(f"Unsupported calendar type: {self.calendar_type}")
    
    def create_event(
        self,
        summary: str,
        start_time: str,
        end_time: str,
        description: str = "",
        location: str = "",
        calendar_id: Optional[str] = None,
        attendees: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """
        Create a new calendar event.
        
        Args:
            summary: Event summary/title
            start_time: Start time in ISO format or relative time
            end_time: End time in ISO format or relative time
            description: Event description
            location: Event location
            calendar_id: Calendar ID (for Google Calendar)
            attendees: List of attendee email addresses
            
        Returns:
            Created event details
        """
        # Parse times
        start_dt = self._parse_time(start_time)
        end_dt = self._parse_time(end_time)
        
        # Use default calendar if not specified
        if not calendar_id:
            calendar_id = self._get_default_calendar_id()
        
        # Initialize attendees list
        attendees = attendees or []
        
        if self.calendar_type == 'google':
            # Create event for Google Calendar
            event = {
                'summary': summary,
                'location': location,
                'description': description,
                'start': {
                    'dateTime': start_dt.isoformat(),
                    'timeZone': 'UTC',
                },
                'end': {
                    'dateTime': end_dt.isoformat(),
                    'timeZone': 'UTC',
                },
                'attendees': [{'email': email} for email in attendees],
                'reminders': {
                    'useDefault': True
                }
            }
            
            # Call Google Calendar API
            created_event = self.google_calendar_service.events().insert(
                calendarId=calendar_id,
                body=event
            ).execute()
            
            # Return created event in standard format
            return {
                'id': created_event.get('id'),
                'summary': created_event.get('summary'),
                'start': created_event.get('start').get('dateTime'),
                'end': created_event.get('end').get('dateTime'),
                'description': created_event.get('description', ''),
                'location': created_event.get('location', ''),
                'creator': created_event.get('creator', {}).get('email', ''),
                'attendees': [
                    attendee.get('email')
                    for attendee in created_event.get('attendees', [])
                ],
                'link': created_event.get('htmlLink', '')
            }
            
        elif self.calendar_type == 'local':
            # For local calendar, we'd need to update the ICS file
            # This is more complex and not fully implemented
            raise NotImplementedError("Creating events in local calendars is not yet implemented")
            
        elif self.calendar_type == 'mock':
            # Return mock data
            event_id = str(hash(summary + start_time + end_time) % 10000)
            return {
                'id': event_id,
                'summary': summary,
                'start': start_dt.isoformat(),
                'end': end_dt.isoformat(),
                'description': description,
                'location': location,
                'creator': 'user@example.com',
                'attendees': attendees,
                'link': ''
            }
            
        else:
            raise ValueError(f"Unsupported calendar type: {self.calendar_type}")
    
    def update_event(
        self,
        event_id: str,
        summary: Optional[str] = None,
        start_time: Optional[str] = None,
        end_time: Optional[str] = None,
        description: Optional[str] = None,
        location: Optional[str] = None,
        calendar_id: Optional[str] = None,
        attendees: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """
        Update an existing calendar event.
        
        Args:
            event_id: Event ID
            summary: Event summary/title
            start_time: Start time in ISO format or relative time
            end_time: End time in ISO format or relative time
            description: Event description
            location: Event location
            calendar_id: Calendar ID (for Google Calendar)
            attendees: List of attendee email addresses
            
        Returns:
            Updated event details
        """
        # Use default calendar if not specified
        if not calendar_id:
            calendar_id = self._get_default_calendar_id()
        
        if self.calendar_type == 'google':
            # Get existing event
            event = self.google_calendar_service.events().get(
                calendarId=calendar_id,
                eventId=event_id
            ).execute()
            
            # Update fields if provided
            if summary is not None:
                event['summary'] = summary
            
            if description is not None:
                event['description'] = description
            
            if location is not None:
                event['location'] = location
            
            if start_time is not None:
                start_dt = self._parse_time(start_time)
                event['start'] = {
                    'dateTime': start_dt.isoformat(),
                    'timeZone': 'UTC',
                }
            
            if end_time is not None:
                end_dt = self._parse_time(end_time)
                event['end'] = {
                    'dateTime': end_dt.isoformat(),
                    'timeZone': 'UTC',
                }
            
            if attendees is not None:
                event['attendees'] = [{'email': email} for email in attendees]
            
            # Call Google Calendar API
            updated_event = self.google_calendar_service.events().update(
                calendarId=calendar_id,
                eventId=event_id,
                body=event
            ).execute()
            
            # Return updated event in standard format
            return {
                'id': updated_event.get('id'),
                'summary': updated_event.get('summary'),
                'start': updated_event.get('start').get('dateTime'),
                'end': updated_event.get('end').get('dateTime'),
                'description': updated_event.get('description', ''),
                'location': updated_event.get('location', ''),
                'creator': updated_event.get('creator', {}).get('email', ''),
                'attendees': [
                    attendee.get('email')
                    for attendee in updated_event.get('attendees', [])
                ],
                'link': updated_event.get('htmlLink', '')
            }
            
        elif self.calendar_type == 'local':
            # For local calendar, we'd need to update the ICS file
            # This is more complex and not fully implemented
            raise NotImplementedError("Updating events in local calendars is not yet implemented")
            
        elif self.calendar_type == 'mock':
            # Return mock data
            return {
                'id': event_id,
                'summary': summary or 'Updated Event',
                'start': start_time or '2023-04-15T10:00:00',
                'end': end_time or '2023-04-15T11:00:00',
                'description': description or '',
                'location': location or '',
                'creator': 'user@example.com',
                'attendees': attendees or [],
                'link': ''
            }
            
        else:
            raise ValueError(f"Unsupported calendar type: {self.calendar_type}")
    
    def delete_event(
        self,
        event_id: str,
        calendar_id: Optional[str] = None
    ) -> bool:
        """
        Delete a calendar event.
        
        Args:
            event_id: Event ID
            calendar_id: Calendar ID (for Google Calendar)
            
        Returns:
            True if successful, False otherwise
        """
        # Use default calendar if not specified
        if not calendar_id:
            calendar_id = self._get_default_calendar_id()
        
        if self.calendar_type == 'google':
            # Call Google Calendar API
            self.google_calendar_service.events().delete(
                calendarId=calendar_id,
                eventId=event_id
            ).execute()
            
            return True
            
        elif self.calendar_type == 'local':
            # For local calendar, we'd need to update the ICS file
            # This is more complex and not fully implemented
            raise NotImplementedError("Deleting events in local calendars is not yet implemented")
            
        elif self.calendar_type == 'mock':
            # Simulate successful deletion
            return True
            
        else:
            raise ValueError(f"Unsupported calendar type: {self.calendar_type}")
    
    def list_calendars(self) -> List[Dict[str, Any]]:
        """
        List available calendars.
        
        Returns:
            List of available calendars
        """
        if self.calendar_type == 'google':
            # Call Google Calendar API
            calendars_result = self.google_calendar_service.calendarList().list().execute()
            calendars = calendars_result.get('items', [])
            
            # Process calendars to standardize format
            return [
                {
                    'id': calendar.get('id'),
                    'summary': calendar.get('summary', 'Untitled Calendar'),
                    'description': calendar.get('description', ''),
                    'primary': calendar.get('primary', False),
                    'access_role': calendar.get('accessRole', ''),
                    'time_zone': calendar.get('timeZone', '')
                }
                for calendar in calendars
            ]
            
        elif self.calendar_type == 'local':
            # For local calendar, just return a single calendar
            return [
                {
                    'id': 'default',
                    'summary': 'Local Calendar',
                    'description': 'Local iCalendar file',
                    'primary': True,
                    'access_role': 'owner',
                    'time_zone': 'UTC'
                }
            ]
            
        elif self.calendar_type == 'mock':
            # Return mock data
            return [
                {
                    'id': 'primary',
                    'summary': 'Primary Calendar',
                    'description': 'Main calendar',
                    'primary': True,
                    'access_role': 'owner',
                    'time_zone': 'UTC'
                },
                {
                    'id': 'work',
                    'summary': 'Work Calendar',
                    'description': 'Work-related events',
                    'primary': False,
                    'access_role': 'owner',
                    'time_zone': 'UTC'
                },
                {
                    'id': 'personal',
                    'summary': 'Personal Calendar',
                    'description': 'Personal events',
                    'primary': False,
                    'access_role': 'owner',
                    'time_zone': 'UTC'
                }
            ]
            
        else:
            raise ValueError(f"Unsupported calendar type: {self.calendar_type}")
    
    def get_availability(
        self,
        start_time: str,
        end_time: str,
        calendar_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Get free/busy information for a time range.
        
        Args:
            start_time: Start time in ISO format or relative time
            end_time: End time in ISO format or relative time
            calendar_id: Calendar ID (for Google Calendar)
            
        Returns:
            Free/busy information
        """
        # Parse times
        start_dt = self._parse_time(start_time)
        end_dt = self._parse_time(end_time)
        
        # Use default calendar if not specified
        if not calendar_id:
            calendar_id = self._get_default_calendar_id()
        
        if self.calendar_type == 'google':
            # Call Google Calendar API
            freebusy_query = {
                'timeMin': start_dt.isoformat(),
                'timeMax': end_dt.isoformat(),
                'timeZone': 'UTC',
                'items': [{'id': calendar_id}]
            }
            
            freebusy_result = self.google_calendar_service.freebusy().query(body=freebusy_query).execute()
            busy_periods = freebusy_result.get('calendars', {}).get(calendar_id, {}).get('busy', [])
            
            # Process busy periods to standardize format
            busy_times = [
                {
                    'start': period.get('start'),
                    'end': period.get('end')
                }
                for period in busy_periods
            ]
            
            # Calculate free periods
            free_times = []
            current_time = start_dt.isoformat()
            
            for busy in busy_times:
                # Add free period before busy period
                if current_time < busy['start']:
                    free_times.append({
                        'start': current_time,
                        'end': busy['start']
                    })
                
                # Move current time to end of busy period
                current_time = busy['end']
            
            # Add final free period if needed
            end_time_iso = end_dt.isoformat()
            if current_time < end_time_iso:
                free_times.append({
                    'start': current_time,
                    'end': end_time_iso
                })
            
            return {
                'busy': busy_times,
                'free': free_times
            }
            
        elif self.calendar_type == 'local':
            # Parse local calendar file and calculate busy periods
            with open(self.local_calendar_path, 'rb') as f:
                cal = icalendar.Calendar.from_ical(f.read())
            
            busy_times = []
            for component in cal.walk():
                if component.name == "VEVENT":
                    # Get event start and end times
                    event_start = component.get('dtstart').dt
                    event_end = component.get('dtend').dt
                    
                    # Convert to datetime if date
                    if isinstance(event_start, datetime.date) and not isinstance(event_start, datetime.datetime):
                        event_start = datetime.datetime.combine(event_start, datetime.time.min)
                    
                    if isinstance(event_end, datetime.date) and not isinstance(event_end, datetime.datetime):
                        event_end = datetime.datetime.combine(event_end, datetime.time.min)
                    
                    # Check if event overlaps with requested range
                    if event_end > start_dt and event_start < end_dt:
                        # Add busy period
                        busy_start = max(event_start, start_dt)
                        busy_end = min(event_end, end_dt)
                        
                        busy_times.append({
                            'start': busy_start.isoformat(),
                            'end': busy_end.isoformat()
                        })
            
            # Sort busy times by start time
            busy_times.sort(key=lambda x: x['start'])
            
            # Calculate free periods
            free_times = []
            current_time = start_dt.isoformat()
            
            for busy in busy_times:
                # Add free period before busy period
                if current_time < busy['start']:
                    free_times.append({
                        'start': current_time,
                        'end': busy['start']
                    })
                
                # Move current time to end of busy period
                current_time = busy['end']
            
            # Add final free period if needed
            end_time_iso = end_dt.isoformat()
            if current_time < end_time_iso:
                free_times.append({
                    'start': current_time,
                    'end': end_time_iso
                })
            
            return {
                'busy': busy_times,
                'free': free_times
            }
            
        elif self.calendar_type == 'mock':
            # Return mock data
            busy_times = [
                {
                    'start': (start_dt + datetime.timedelta(hours=1)).isoformat(),
                    'end': (start_dt + datetime.timedelta(hours=2)).isoformat()
                },
                {
                    'start': (start_dt + datetime.timedelta(hours=4)).isoformat(),
                    'end': (start_dt + datetime.timedelta(hours=5)).isoformat()
                }
            ]
            
            # Calculate free periods
            free_times = [
                {
                    'start': start_dt.isoformat(),
                    'end': (start_dt + datetime.timedelta(hours=1)).isoformat()
                },
                {
                    'start': (start_dt + datetime.timedelta(hours=2)).isoformat(),
                    'end': (start_dt + datetime.timedelta(hours=4)).isoformat()
                },
                {
                    'start': (start_dt + datetime.timedelta(hours=5)).isoformat(),
                    'end': end_dt.isoformat()
                }
            ]
            
            return {
                'busy': busy_times,
                'free': free_times
            }
            
        else:
            raise ValueError(f"Unsupported calendar type: {self.calendar_type}") 