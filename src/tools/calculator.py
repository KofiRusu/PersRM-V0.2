"""
Calculator Tool

This module implements a calculator tool for performing mathematical operations.
"""

import math
import logging
import re
from typing import Dict, List, Optional, Any, Union
import numexpr as ne
import numpy as np

from src.tools.base import Tool, ToolError

logger = logging.getLogger(__name__)

class Calculator(Tool):
    """Tool for performing mathematical calculations."""
    
    def __init__(self, config: Dict[str, Any] = None):
        """Initialize the calculator tool.
        
        Args:
            config: Configuration for the tool
        """
        super().__init__(
            name="calculator",
            description="Perform mathematical calculations",
            config=config
        )
        
        # Allowed functions for numexpr
        self.allowed_functions = self.config.get(
            "allowed_functions", 
            ["sin", "cos", "tan", "arcsin", "arccos", "arctan", "sqrt", "log", "log10", "exp", "abs"]
        )
        
        # Maximum allowed computation time in seconds
        self.max_computation_time = self.config.get("max_computation_time", 5)
        
        # Whether to provide detailed step-by-step calculation
        self.show_steps = self.config.get("show_steps", True)
    
    def _get_parameter_schema(self) -> Dict[str, Any]:
        """Get the parameter schema for this tool."""
        return {
            "type": "object",
            "properties": {
                "expression": {
                    "type": "string",
                    "description": "Mathematical expression to evaluate"
                },
                "variables": {
                    "type": "object",
                    "description": "Variables to use in the expression",
                    "additionalProperties": {"type": "number"}
                },
                "precision": {
                    "type": "integer",
                    "description": "Number of decimal places in the result",
                    "default": 6
                },
                "show_steps": {
                    "type": "boolean",
                    "description": "Whether to provide step-by-step calculation",
                    "default": True
                }
            },
            "required": ["expression"]
        }
    
    def _is_safe_expression(self, expression: str) -> bool:
        """Check if an expression is safe to evaluate.
        
        Args:
            expression: Expression to check
            
        Returns:
            True if the expression is safe, False otherwise
        """
        # Check for potentially dangerous operations
        dangerous_patterns = [
            r"__.*__",  # Dunder methods
            r"import",  # Import statement
            r"exec\s*\(",  # exec() function
            r"eval\s*\(",  # eval() function
            r"globals\s*\(",  # globals() function
            r"locals\s*\(",  # locals() function
            r"getattr\s*\(",  # getattr() function
            r"setattr\s*\(",  # setattr() function
            r"delattr\s*\(",  # delattr() function
            r"open\s*\(",  # open() function
            r"file\s*\(",  # file() function
            r"compile\s*\(",  # compile() function
            r"\bos\.",  # os module
            r"\bsys\.",  # sys module
            r"\bsubprocess\.",  # subprocess module
            r"\bshutil\.",  # shutil module
        ]
        
        for pattern in dangerous_patterns:
            if re.search(pattern, expression, re.IGNORECASE):
                return False
        
        return True
    
    def _parse_expression(self, expression: str) -> str:
        """Parse and normalize a mathematical expression.
        
        Args:
            expression: Expression to parse
            
        Returns:
            Normalized expression
            
        Raises:
            ToolError: If the expression is invalid
        """
        # Remove whitespace
        expression = expression.strip()
        
        # Basic validation
        if not expression:
            raise ToolError("Expression cannot be empty")
        
        # Check for safety
        if not self._is_safe_expression(expression):
            raise ToolError("Expression contains potentially dangerous operations")
        
        # Replace common mathematical notations
        replacements = {
            "^": "**",  # Replace caret with power operator
            "÷": "/",   # Replace division symbol
            "×": "*",   # Replace multiplication symbol
            "π": "pi",  # Replace pi symbol
            "√": "sqrt" # Replace square root symbol
        }
        
        for old, new in replacements.items():
            expression = expression.replace(old, new)
        
        return expression
    
    def execute(
        self, 
        expression: str, 
        variables: Dict[str, Union[int, float]] = None, 
        precision: int = 6,
        show_steps: bool = None
    ) -> Dict[str, Any]:
        """Evaluate a mathematical expression.
        
        Args:
            expression: Mathematical expression to evaluate
            variables: Variables to use in the expression
            precision: Number of decimal places in the result
            show_steps: Whether to provide step-by-step calculation
            
        Returns:
            Dictionary with the result and optionally step-by-step calculation
            
        Raises:
            ToolError: If the expression is invalid or cannot be evaluated
        """
        if show_steps is None:
            show_steps = self.show_steps
            
        # Initialize variables dictionary with constants
        vars_dict = {
            "pi": math.pi,
            "e": math.e
        }
        
        # Add user-provided variables
        if variables:
            vars_dict.update(variables)
        
        try:
            # Parse and normalize the expression
            parsed_expression = self._parse_expression(expression)
            
            # Evaluate using numexpr (safer than eval)
            result = float(ne.evaluate(parsed_expression, local_dict=vars_dict))
            
            # Format the result with the specified precision
            if math.isnan(result):
                formatted_result = "NaN"
            elif math.isinf(result):
                formatted_result = "Infinity" if result > 0 else "-Infinity"
            else:
                formatted_result = f"{result:.{precision}f}".rstrip("0").rstrip(".")
            
            # Result to return
            calculation_result = {
                "expression": expression,
                "parsed_expression": parsed_expression,
                "result": result,
                "formatted_result": formatted_result
            }
            
            # Add step-by-step calculation if requested
            if show_steps:
                steps = self._generate_steps(expression, parsed_expression, variables, result)
                calculation_result["steps"] = steps
            
            return calculation_result
            
        except ne.NumExprError as e:
            logger.exception(f"NumExpr error evaluating expression: {expression}")
            raise ToolError(f"Error evaluating expression: {str(e)}")
        except Exception as e:
            logger.exception(f"Error evaluating expression: {expression}")
            raise ToolError(f"Error evaluating expression: {str(e)}")
    
    def _generate_steps(
        self, 
        original_expression: str, 
        parsed_expression: str, 
        variables: Dict[str, Union[int, float]], 
        result: float
    ) -> List[str]:
        """Generate step-by-step calculation.
        
        This is a simple implementation that just shows variable substitution.
        For complex expressions, a proper expression parser would be needed.
        
        Args:
            original_expression: Original expression provided by the user
            parsed_expression: Parsed and normalized expression
            variables: Variables used in the expression
            result: Final result
            
        Returns:
            List of steps
        """
        steps = []
        
        # Step 1: Show the original expression
        steps.append(f"Original expression: {original_expression}")
        
        # Step 2: Show the parsed expression if different
        if original_expression != parsed_expression:
            steps.append(f"Normalized expression: {parsed_expression}")
        
        # Step 3: Show variable substitutions
        if variables:
            expr_with_vars = parsed_expression
            for var_name, var_value in variables.items():
                var_formatted = f"{var_value}"
                if isinstance(var_value, float) and var_value != int(var_value):
                    var_formatted = f"{var_value:.6f}".rstrip("0").rstrip(".")
                expr_with_vars = re.sub(r'\b' + var_name + r'\b', var_formatted, expr_with_vars)
            steps.append(f"With variables substituted: {expr_with_vars}")
        
        # Step 4: Show the result
        result_formatted = f"{result:.6f}".rstrip("0").rstrip(".") if result != int(result) else f"{int(result)}"
        steps.append(f"Result: {result_formatted}")
        
        return steps 