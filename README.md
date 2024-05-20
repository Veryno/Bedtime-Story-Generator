# Bedtime Story Generator

This project is a submission for the final project of my CS355 class. The aim is to develop a full-stack web application that allows users to generate AI-driven bedtime stories based on their prompts and converts them into downloadable MP3 audio files.

## Project Description

The Bedtime Story Generator uses two APIs to achieve its functionality:
1. **Anthropic Claude AI API**: Generates bedtime stories based on user prompts.
2. **Google Text-to-Speech API**: Converts the generated stories into MP3 audio files.

The project demonstrates synchronous API calls, robust error handling, and the ability to handle multiple requests simultaneously.

## Features

- User-friendly interface for entering prompts and generating stories.
- Integration with Anthropic Claude AI for story creation.
- Integration with Google Text-to-Speech API for converting text to speech.
- Secure authentication using Google service accounts and JWTs.
- Error handling for various input scenarios.
- Capability to handle multiple concurrent requests.

## Technologies Used

- Node.js
- HTTP/HTTPS
- Google Cloud APIs
- Anthropic Claude AI API
- HTML/CSS

## Error Handling

- The application provides meaningful error messages for invalid inputs.
- Ensures the first API call completes before the second one starts, maintaining synchronous operation.
- Capable of handling multiple user requests without server restart.

## Resilience

- The server handles unexpected inputs gracefully and returns appropriate HTTP status codes.
- The application is designed to manage multiple requests simultaneously using asynchronous operations.

## Caching

- Caching is not implemented in this project due to the dynamic nature of user inputs and generated stories.

## Sequence Diagram

A formalized HTTP sequence diagram is included to describe the non-cached use of the application, including all calls to each API.


