import React from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet } from 'react-native';

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

const LetterPickerModal = ({ visible, onChooseLetter, onCancel }) => {
    if (!visible) return null;

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onCancel}
        >
            <TouchableOpacity
                style={styles.overlay}
                activeOpacity={1}
                onPress={onCancel}
            >
                <View style={styles.content} onStartShouldSetResponder={() => true}>
                    <Text style={styles.title}>Choose letter for blank</Text>
                    <View style={styles.grid}>
                        {LETTERS.map((letter) => (
                            <TouchableOpacity
                                key={letter}
                                style={styles.letterButton}
                                onPress={() => onChooseLetter(letter)}
                                activeOpacity={0.7}
                            >
                                <Text style={styles.letterText}>{letter}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                    <TouchableOpacity style={styles.cancelButton} onPress={onCancel}>
                        <Text style={styles.cancelButtonText}>Cancel</Text>
                    </TouchableOpacity>
                </View>
            </TouchableOpacity>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    content: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 24,
        maxWidth: 340,
        width: '100%',
        alignItems: 'center',
    },
    title: {
        fontSize: 18,
        fontWeight: '700',
        color: '#2c3e50',
        marginBottom: 16,
    },
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'center',
        gap: 8,
        marginBottom: 20,
    },
    letterButton: {
        width: 40,
        height: 40,
        borderRadius: 8,
        backgroundColor: '#f5ebe0',
        borderWidth: 1,
        borderColor: '#bdc3c7',
        justifyContent: 'center',
        alignItems: 'center',
    },
    letterText: {
        fontSize: 18,
        fontWeight: '700',
        color: '#2c3e50',
    },
    cancelButton: {
        paddingVertical: 10,
        paddingHorizontal: 24,
    },
    cancelButtonText: {
        fontSize: 16,
        color: '#667eea',
        fontWeight: '600',
    },
});

export default LetterPickerModal;
