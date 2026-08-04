import pytest

from pricing import calculate_sale_price, markup_rate


@pytest.mark.parametrize(
    ("purchase_price", "expected_markup"),
    [
        (0.01, 0.70), (3.00, 0.70), (3.01, 0.60),
        (6.00, 0.60), (6.01, 0.50), (18.00, 0.50),
        (18.01, 0.40), (30.00, 0.40), (30.01, 0.30),
    ],
)
def test_markup_boundaries(purchase_price, expected_markup):
    assert float(markup_rate(purchase_price)) == expected_markup


def test_sale_price_includes_vat_and_rounds_to_ten_cents():
    assert calculate_sale_price(10) == 18.3
    assert calculate_sale_price(20) == 34.2
    assert calculate_sale_price(40) == 63.4


def test_zero_or_negative_purchase_price_stays_zero():
    assert calculate_sale_price(0) == 0
    assert calculate_sale_price(-1) == 0


def test_custom_markup_is_used_without_changing_vat_or_rounding():
    custom = {"upTo18": 25}
    assert calculate_sale_price(10, custom) == 15.3
