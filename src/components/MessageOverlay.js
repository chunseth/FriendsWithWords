import React from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet } from 'react-native';

const MessageOverlay = ({ message, onClose }) => {
    if (!message) return null;
    
    return (
        <Modal
            visible={!!message}
            transparent={true}
            animationType="fade"
            onRequestClose={onClose}
        >
            <TouchableOpacity 
                style={styles.overlay} 
                activeOpacity={1}
                onPress={onClose}
            >
                <TouchableOpacity 
                    style={styles.content} 
                    activeOpacity={1}
                    onPress={(e) => e.stopPropagation()}
                >
                    <Text style={styles.title}>{message.title}</Text>
                    <Text style={styles.text}>{message.text}</Text>
                    <TouchableOpacity style={styles.button} onPress={onClose}>
                        <Text style={styles.buttonText}>OK</Text>
                    </TouchableOpacity>
                </TouchableOpacity>
            </TouchableOpacity>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    content: {
        backgroundColor: 'white',
        borderRadius: 15,
        padding: 30,
        maxWidth: 400,
        width: '100%',
        alignItems: 'center',
    },
    title: {
        fontSize: 20,
        fontWeight: '700',
        color: '#2c3e50',
        marginBottom: 15,
    },
    text: {
        fontSize: 16,
        color: '#7f8c8d',
        marginBottom: 20,
        textAlign: 'center',
        lineHeight: 22,
    },
    button: {
        backgroundColor: '#667eea',
        borderRadius: 8,
        padding: 12,
        minWidth: 100,
        alignItems: 'center',
    },
    buttonText: {
        color: 'white',
        fontWeight: '600',
        fontSize: 16,
    },
});

export default MessageOverlay;

