"""Controlli statici che non richiedono MongoDB o un server avviato."""

import ast
from collections import Counter
from pathlib import Path


SERVER_PATH = Path(__file__).parents[1] / "server.py"


def _server_tree():
    return ast.parse(SERVER_PATH.read_text(encoding="utf-8"))


def _api_routes():
    routes = []
    for node in _server_tree().body:
        if not isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            continue
        for decorator in node.decorator_list:
            if not (
                isinstance(decorator, ast.Call)
                and isinstance(decorator.func, ast.Attribute)
                and decorator.args
                and isinstance(decorator.args[0], ast.Constant)
                and decorator.func.attr in {"get", "post", "put", "patch", "delete"}
            ):
                continue
            routes.append((decorator.func.attr, decorator.args[0].value, node.name))
    return routes


def test_api_routes_are_unique():
    counts = Counter((method, path) for method, path, _ in _api_routes())
    assert not [route for route, count in counts.items() if count > 1]


def test_pending_products_route_calls_the_creation_handler():
    assert (
        "post",
        "/invoices/pending-products/create",
        "create_pending_invoice_products",
    ) in _api_routes()


def test_api_authentication_middleware_is_registered():
    middleware_names = {
        node.name
        for node in _server_tree().body
        if isinstance(node, ast.AsyncFunctionDef)
        and any(
            isinstance(decorator, ast.Call)
            and isinstance(decorator.func, ast.Attribute)
            and decorator.func.attr == "middleware"
            for decorator in node.decorator_list
        )
    }
    assert "require_api_authentication" in middleware_names


def test_health_route_is_available():
    assert ("get", "/health", "health_check") in _api_routes()


def test_shared_invoice_history_routes_are_available():
    routes = set(_api_routes())
    assert ("post", "/invoices/sync", "sync_invoice_history") in routes
    assert (
        "get",
        "/invoices/{chiave_import}/exists",
        "invoice_history_exists",
    ) in routes
    assert (
        "get",
        "/invoices/{chiave_import}/products",
        "get_shared_invoice_products",
    ) in routes
