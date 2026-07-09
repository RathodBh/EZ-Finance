import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import PremiumSwitch from './PremiumSwitch';
import { TouchableOpacity } from 'react-native';

describe('PremiumSwitch Component', () => {
  it('renders correctly', () => {
    const onValueChange = jest.fn();
    const { UNSAFE_getByType } = render(
      <PremiumSwitch
        value={false}
        onValueChange={onValueChange}
        activeColor="#10B981"
        inactiveColor="#374151"
      />
    );

    const touchable = UNSAFE_getByType(TouchableOpacity);
    expect(touchable).toBeTruthy();
  });

  it('triggers onValueChange with toggled value when pressed', () => {
    const onValueChange = jest.fn();
    const { UNSAFE_getByType } = render(
      <PremiumSwitch
        value={false}
        onValueChange={onValueChange}
        activeColor="#10B981"
        inactiveColor="#374151"
      />
    );

    const touchable = UNSAFE_getByType(TouchableOpacity);
    fireEvent.press(touchable);
    expect(onValueChange).toHaveBeenCalledWith(true);
  });

  it('does not trigger onValueChange when disabled', () => {
    const onValueChange = jest.fn();
    const { UNSAFE_getByType } = render(
      <PremiumSwitch
        value={false}
        onValueChange={onValueChange}
        activeColor="#10B981"
        inactiveColor="#374151"
        disabled={true}
      />
    );

    const touchable = UNSAFE_getByType(TouchableOpacity);
    fireEvent.press(touchable);
    expect(onValueChange).not.toHaveBeenCalled();
  });
});
